import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import type { FunctionTool } from "openai/resources/responses/responses";
import { ToolTrace } from "./investigation.types";

export const investigationMcpTools = {
  customers: ["customers_search", "customers_get"],
  inventory: [
    "inventory_search_devices",
    "inventory_get_device",
    "inventory_topology",
  ],
  telemetry: ["telemetry_list_informs", "telemetry_list_daily_metrics"],
  diagnostics: ["diagnostics_list"],
  tickets: ["tickets_list", "tickets_get"],
  operations: [
    "operations_list_dataset_loads",
    "operations_list_grouping_candidates",
    "operations_list_active_groupings",
  ],
  application: [
    "application_get_health",
    "dashboard_get_overview",
    "network_get_topology",
    "network_search_topology",
    "network_list_topology_devices",
    "network_list_detected_groupings",
    "network_get_detected_grouping",
    "customers_get_support",
    "tickets_list_noc_queue",
    "incidents_list_active",
    "incidents_list_options",
    "investigations_list",
    "investigations_get_config",
  ],
} as const;

export function investigationMcpPolicy() {
  const domains = Object.entries(investigationMcpTools).map(
    ([domain, tools]) => ({ domain, tools: [...tools] }),
  );
  return {
    endpointCount: domains.length,
    toolCount: domains.reduce((total, item) => total + item.tools.length, 0),
    domains,
  };
}

type RegisteredTool = {
  domain: keyof typeof investigationMcpTools;
  client: Client;
};

const DEFAULT_MAX_TOOL_OUTPUT_CHARS = 10_000;
const DEFAULT_MAX_PAGE_SIZE_FOR_AGENT = 50;

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(minimum, Math.min(maximum, Math.floor(parsed)))
    : fallback;
}

export function normalizeAgentToolArguments(
  value: Record<string, unknown>,
  maximumPageSize = boundedInteger(
    process.env.AGENT_MAX_PAGE_SIZE,
    DEFAULT_MAX_PAGE_SIZE_FOR_AGENT,
    10,
    100,
  ),
): Record<string, unknown> {
  const normalized = { ...value };
  if (typeof normalized.pageSize === "number") {
    normalized.pageSize = Math.max(
      1,
      Math.min(maximumPageSize, Math.floor(normalized.pageSize)),
    );
  }
  return normalized;
}

export function compactToolOutput(
  payload: unknown,
  maximumCharacters = DEFAULT_MAX_TOOL_OUTPUT_CHARS,
): string {
  const serialized = JSON.stringify(payload);
  if (serialized.length <= maximumCharacters) return serialized;

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const object = payload as Record<string, unknown>;
    if (Array.isArray(object.data)) {
      const originalItems = object.data;
      for (let count = originalItems.length - 1; count >= 0; count -= 1) {
        const candidate = JSON.stringify({
          ...object,
          data: originalItems.slice(0, count),
          truncatedForAgent: true,
          originalItemCount: originalItems.length,
          guidance:
            "Refine os filtros ou use paginação se precisar de outros registros.",
        });
        if (candidate.length <= maximumCharacters) return candidate;
      }
    }
  }

  let previewLength = Math.max(0, maximumCharacters - 180);
  while (previewLength >= 0) {
    const candidate = JSON.stringify({
      truncatedForAgent: true,
      originalCharacters: serialized.length,
      preview: serialized.slice(0, previewLength),
    });
    if (candidate.length <= maximumCharacters) return candidate;
    previewLength -= 100;
  }
  return JSON.stringify({ truncatedForAgent: true });
}

export class McpToolRegistry {
  private readonly clients: Client[] = [];
  private readonly registered = new Map<string, RegisteredTool>();
  private readonly maxToolOutputCharacters = boundedInteger(
    process.env.AGENT_MAX_TOOL_OUTPUT_CHARS,
    DEFAULT_MAX_TOOL_OUTPUT_CHARS,
    2_000,
    30_000,
  );

  constructor(
    private readonly baseUrl = process.env.INTERNAL_MCP_BASE_URL ??
      "http://127.0.0.1:3000",
  ) {}

  async load(): Promise<FunctionTool[]> {
    const tools: FunctionTool[] = [];
    for (const [domain, allowedNames] of Object.entries(
      investigationMcpTools,
    ) as Array<[keyof typeof investigationMcpTools, readonly string[]]>) {
      const client = new Client({
        name: `ondaluz-agent-${domain}`,
        version: "1.0.0",
      });
      await client.connect(
        new StreamableHTTPClientTransport(
          new URL(`${this.baseUrl.replace(/\/$/, "")}/mcp/${domain}`),
        ),
      );
      this.clients.push(client);
      const listed = await client.listTools();
      for (const tool of listed.tools) {
        if (!allowedNames.includes(tool.name)) continue;
        this.registered.set(tool.name, { domain, client });
        tools.push({
          type: "function",
          name: tool.name,
          description: `[MCP ${domain}] ${tool.description ?? "Consulta somente leitura."}`,
          parameters: tool.inputSchema as Record<string, unknown>,
          strict: false,
        });
      }
    }
    return tools;
  }

  async call(
    name: string,
    argumentsValue: Record<string, unknown>,
  ): Promise<{ output: string; trace: ToolTrace }> {
    const registered = this.registered.get(name);
    if (!registered) throw new Error(`Ferramenta MCP não permitida: ${name}`);
    const normalizedArguments = normalizeAgentToolArguments(argumentsValue);
    const result = await registered.client.callTool({
      name,
      arguments: normalizedArguments,
    });
    if (result.isError) {
      throw new Error(`A ferramenta MCP ${name} retornou erro.`);
    }
    const payload = result.structuredContent ?? result.content;
    const output = compactToolOutput(payload, this.maxToolOutputCharacters);
    return {
      output,
      trace: {
        domain: registered.domain,
        tool: name,
        arguments: normalizedArguments,
        outputPreview:
          output.length > 2_000 ? `${output.slice(0, 2_000)}…` : output,
      },
    };
  }

  async close(): Promise<void> {
    await Promise.allSettled(this.clients.map((client) => client.close()));
  }
}
