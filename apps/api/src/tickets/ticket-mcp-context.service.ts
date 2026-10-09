import { Injectable, NotFoundException } from "@nestjs/common";
import { McpToolRegistry } from "../investigations/mcp-tool-registry";

type JsonRecord = Record<string, unknown>;

export type TicketMcpEvidenceSource = {
  domain: string;
  tool: string;
  status: "ok" | "error";
  recordCount: number | null;
  data: unknown;
  error?: string;
  arguments: Record<string, unknown>;
};

export type TicketMcpContext = {
  ticketId: string;
  collectedAt: string;
  status: "complete" | "partial" | "failed";
  scope: {
    customerId: string | null;
    serial: string | null;
    olt: string | null;
    pon: string | null;
    cto: string | null;
  };
  summary: {
    requestedToolCount: number;
    successfulToolCount: number;
    failedToolCount: number;
    domainCount: number;
    domains: string[];
    recordsCollected: number;
  };
  sources: TicketMcpEvidenceSource[];
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pageRecords(value: unknown): JsonRecord[] {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.data)) return [];
  return record.data.filter((item): item is JsonRecord =>
    Boolean(asRecord(item)),
  );
}

function recordCount(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  const record = asRecord(value);
  if (!record) return null;
  if (Array.isArray(record.data)) return record.data.length;
  return 1;
}

function parseToolOutput(output: string): unknown {
  try {
    return JSON.parse(output) as unknown;
  } catch {
    return { raw: output };
  }
}

function safeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Falha ao consultar a fonte MCP.";
}

@Injectable()
export class TicketMcpContextService {
  async collect(ticketId: string): Promise<TicketMcpContext> {
    const normalizedTicketId = ticketId.trim().toUpperCase();
    const registry = new McpToolRegistry();
    const sources: TicketMcpEvidenceSource[] = [];
    let loaded = false;

    try {
      await registry.load();
      loaded = true;

      const call = async (
        domain: string,
        tool: string,
        argumentsValue: Record<string, unknown>,
        required = false,
      ): Promise<unknown | null> => {
        try {
          const result = await registry.call(tool, argumentsValue);
          const data = parseToolOutput(result.output);
          sources.push({
            domain,
            tool,
            status: "ok",
            recordCount: recordCount(data),
            data,
            arguments: result.trace.arguments,
          });
          return data;
        } catch (error) {
          sources.push({
            domain,
            tool,
            status: "error",
            recordCount: null,
            data: null,
            error: safeError(error),
            arguments: argumentsValue,
          });
          if (required) throw error;
          return null;
        }
      };

      const ticket = await call(
        "tickets",
        "tickets_get",
        { ticketId: normalizedTicketId },
        true,
      );
      const ticketRecord = asRecord(ticket);
      if (!ticketRecord) {
        throw new NotFoundException("Chamado não encontrado.");
      }

      const customerId = stringValue(ticketRecord.customer_id);
      const ticketOlt = stringValue(ticketRecord.olt);
      const ticketPon = stringValue(ticketRecord.pon);
      const ticketCto = stringValue(ticketRecord.cto);

      const [customer, support, inventory] = await Promise.all([
        customerId
          ? call("customers", "customers_get", { customerId })
          : Promise.resolve(null),
        customerId
          ? call("application", "customers_get_support", { customerId })
          : Promise.resolve(null),
        customerId
          ? call("inventory", "inventory_search_devices", {
              query: customerId,
              status: "all",
              page: 1,
              pageSize: 50,
              sort: "customer_id_asc",
            })
          : Promise.resolve(null),
      ]);

      const inventoryDevices = pageRecords(inventory);
      const activeDevice =
        inventoryDevices.find((device) => device.status === "active") ??
        inventoryDevices[0] ??
        null;
      const serial = stringValue(activeDevice?.serial);
      const olt = stringValue(activeDevice?.olt) ?? ticketOlt;
      const pon = stringValue(activeDevice?.pon_port) ?? ticketPon;
      const cto = stringValue(activeDevice?.cto) ?? ticketCto;
      const equipmentArguments = serial ? { serial } : null;

      await Promise.all([
        equipmentArguments
          ? call("inventory", "inventory_get_device", equipmentArguments)
          : Promise.resolve(null),
        olt && pon && cto
          ? call("inventory", "inventory_topology", {
              olt,
              pon,
              cto,
              page: 1,
              pageSize: 50,
              sort: "customer_id_asc",
            })
          : Promise.resolve(null),
        olt
          ? call("application", "network_get_topology", {
              olt,
              ...(pon ? { pon } : {}),
            })
          : Promise.resolve(null),
        serial || customerId
          ? call("telemetry", "telemetry_list_daily_metrics", {
              ...(serial ? { serial } : {}),
              ...(customerId ? { customerId } : {}),
              page: 1,
              pageSize: 14,
              sort: "day_desc",
            })
          : Promise.resolve(null),
        serial
          ? call("telemetry", "telemetry_list_informs", {
              serial,
              page: 1,
              pageSize: 20,
              sort: "ts_desc",
            })
          : Promise.resolve(null),
        serial || customerId
          ? call("diagnostics", "diagnostics_list", {
              ...(serial ? { serial } : {}),
              ...(customerId ? { customerId } : {}),
              page: 1,
              pageSize: 10,
              sort: "ts_desc",
            })
          : Promise.resolve(null),
        customerId
          ? call("tickets", "tickets_list", {
              query: "",
              customerId,
              page: 1,
              pageSize: 50,
              sort: "opened_at_desc",
            })
          : Promise.resolve(null),
        call("operations", "operations_list_active_groupings", {
          page: 1,
          pageSize: 30,
          sort: "default",
        }),
        call("operations", "operations_list_grouping_candidates", {
          page: 1,
          pageSize: 30,
          sort: "default",
        }),
        call("application", "incidents_list_active", {
          scopeType: "",
          page: 1,
          pageSize: 30,
          sort: "severity_desc",
        }),
      ]);

      // Keep the variables above intentionally named: they make the initial
      // customer/equipment lookup explicit while all source payloads remain
      // available in `sources` for the technician's JSON inspection.
      void customer;
      void support;

      const successful = sources.filter((source) => source.status === "ok");
      const failed = sources.filter((source) => source.status === "error");
      const domains = [...new Set(sources.map((source) => source.domain))];
      const recordsCollected = successful.reduce(
        (total, source) => total + (source.recordCount ?? 0),
        0,
      );

      return {
        ticketId: normalizedTicketId,
        collectedAt: new Date().toISOString(),
        status: failed.length === 0 ? "complete" : "partial",
        scope: { customerId, serial, olt, pon, cto },
        summary: {
          requestedToolCount: sources.length,
          successfulToolCount: successful.length,
          failedToolCount: failed.length,
          domainCount: domains.length,
          domains,
          recordsCollected,
        },
        sources,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (!loaded) {
        throw new Error(
          `Não foi possível conectar aos servidores MCP: ${safeError(error)}`,
        );
      }
      throw error;
    } finally {
      await registry.close();
    }
  }
}
