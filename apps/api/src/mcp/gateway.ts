import { IncomingMessage, ServerResponse } from "node:http";
import {
  hostHeaderValidation,
  originValidation,
  toNodeHandler,
} from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { MCP_ENDPOINTS } from "./catalog.js";
import { CustomerQueries } from "./contexts/customers/application/customer-queries.js";
import { PostgresCustomerRepository } from "./contexts/customers/infrastructure/postgres-customer-repository.js";
import { createCustomerServer } from "./contexts/customers/presentation/customer-server.js";
import { DiagnosticQueries } from "./contexts/diagnostics/application/diagnostic-queries.js";
import { PostgresDiagnosticRepository } from "./contexts/diagnostics/infrastructure/postgres-diagnostic-repository.js";
import { createDiagnosticServer } from "./contexts/diagnostics/presentation/diagnostic-server.js";
import { InventoryQueries } from "./contexts/inventory/application/inventory-queries.js";
import { PostgresInventoryRepository } from "./contexts/inventory/infrastructure/postgres-inventory-repository.js";
import { createInventoryServer } from "./contexts/inventory/presentation/inventory-server.js";
import { OperationsQueries } from "./contexts/operations/application/operations-queries.js";
import { PostgresOperationsRepository } from "./contexts/operations/infrastructure/postgres-operations-repository.js";
import { createOperationsServer } from "./contexts/operations/presentation/operations-server.js";
import { TelemetryQueries } from "./contexts/telemetry/application/telemetry-queries.js";
import { PostgresTelemetryRepository } from "./contexts/telemetry/infrastructure/postgres-telemetry-repository.js";
import { createTelemetryServer } from "./contexts/telemetry/presentation/telemetry-server.js";
import { TicketQueries } from "./contexts/tickets/application/ticket-queries.js";
import { PostgresTicketRepository } from "./contexts/tickets/infrastructure/postgres-ticket-repository.js";
import { createTicketServer } from "./contexts/tickets/presentation/ticket-server.js";
import { Queryable } from "./shared/infrastructure/database.js";
import {
  ApplicationApi,
  createApplicationServer,
} from "./contexts/application/presentation/application-server.js";
import {
  createOpenApiBridgeServer,
  OpenApiBridgeOptions,
  OpenApiDocumentProvider,
} from "./contexts/openapi/presentation/openapi-bridge-server.js";
import {
  elapsedMilliseconds,
  McpStructuredLogger,
  McpRequestLogContext,
  mcpRequestContext,
  newMcpRequestId,
  summarizeForMcpLog,
} from "./shared/infrastructure/mcp-logger.js";

export interface McpGatewayOptions {
  allowedHosts?: string[];
  logger?: McpStructuredLogger;
}

type McpHandler = ReturnType<typeof createMcpHandler>;

function requestPath(request: IncomingMessage): string {
  const rawPath = (request.url ?? "/").split("?", 1)[0];
  return rawPath.length > 1 ? rawPath.replace(/\/$/, "") : rawPath;
}

function writeJson(
  response: ServerResponse,
  status: number,
  body: Record<string, unknown>,
): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function headerValue(request: IncomingMessage, name: string): string | null {
  const value = request.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type RpcDetails = {
  method: string | null;
  id: string | number | null;
  tool: string | null;
  resourceUri: string | null;
  input: unknown;
};

function rpcDetails(body: string): RpcDetails {
  if (!body.trim()) {
    return {
      method: null,
      id: null,
      tool: null,
      resourceUri: null,
      input: null,
    };
  }

  try {
    const parsed = JSON.parse(body) as unknown;
    const envelope =
      typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    const params =
      envelope?.params &&
      typeof envelope.params === "object" &&
      !Array.isArray(envelope.params)
        ? (envelope.params as Record<string, unknown>)
        : null;
    return {
      method: typeof envelope?.method === "string" ? envelope.method : null,
      id:
        typeof envelope?.id === "string" || typeof envelope?.id === "number"
          ? envelope.id
          : null,
      tool: typeof params?.name === "string" ? params.name : null,
      resourceUri: typeof params?.uri === "string" ? params.uri : null,
      input: params?.arguments ?? null,
    };
  } catch {
    return {
      method: null,
      id: null,
      tool: null,
      resourceUri: null,
      input: null,
    };
  }
}

function requestDetails(
  request: IncomingMessage,
  body: string,
): Record<string, unknown> {
  const rpc = rpcDetails(body);
  return {
    http_method: request.method ?? "UNKNOWN",
    route: requestPath(request),
    rpc_method: rpc.method,
    rpc_id: rpc.id,
    tool: rpc.tool,
    resource_uri: rpc.resourceUri,
    input: summarizeForMcpLog(rpc.input),
    user_agent: headerValue(request, "user-agent"),
    content_type: headerValue(request, "content-type"),
  };
}

function statusDetails(response: ServerResponse) {
  return {
    status_code: response.statusCode,
    response_content_type: response.getHeader("content-type") ?? null,
    response_ended: response.writableEnded,
  };
}

export class McpGateway {
  private readonly handlers: ReadonlyArray<readonly [string, McpHandler]>;
  private readonly routes: ReadonlyMap<
    string,
    ReturnType<typeof toNodeHandler>
  >;
  private readonly validateHost: ReturnType<typeof hostHeaderValidation>;
  private readonly validateOrigin: ReturnType<typeof originValidation>;
  private readonly logger: McpStructuredLogger;

  constructor(
    database: Queryable,
    options: McpGatewayOptions = {},
    application?: ApplicationApi,
    openApi?: {
      document: OpenApiDocumentProvider;
      bridge: OpenApiBridgeOptions;
    },
  ) {
    const customers = new CustomerQueries(
      new PostgresCustomerRepository(database),
    );
    const inventory = new InventoryQueries(
      new PostgresInventoryRepository(database),
    );
    const telemetry = new TelemetryQueries(
      new PostgresTelemetryRepository(database),
    );
    const diagnostics = new DiagnosticQueries(
      new PostgresDiagnosticRepository(database),
    );
    const tickets = new TicketQueries(new PostgresTicketRepository(database));
    const operations = new OperationsQueries(
      new PostgresOperationsRepository(database),
    );

    this.handlers = [
      [
        "/mcp/customers",
        createMcpHandler(() => createCustomerServer(customers)),
      ],
      [
        "/mcp/inventory",
        createMcpHandler(() => createInventoryServer(inventory)),
      ],
      [
        "/mcp/telemetry",
        createMcpHandler(() => createTelemetryServer(telemetry)),
      ],
      [
        "/mcp/diagnostics",
        createMcpHandler(() => createDiagnosticServer(diagnostics)),
      ],
      ["/mcp/tickets", createMcpHandler(() => createTicketServer(tickets))],
      [
        "/mcp/operations",
        createMcpHandler(() => createOperationsServer(operations)),
      ],
      ...(application
        ? ([
            [
              "/mcp/application",
              createMcpHandler(() => createApplicationServer(application)),
            ],
          ] as const)
        : []),
      ...(openApi
        ? ([
            [
              "/mcp/openapi",
              createMcpHandler(() =>
                createOpenApiBridgeServer(openApi.document, openApi.bridge),
              ),
            ],
          ] as const)
        : []),
    ];
    this.routes = new Map(
      this.handlers.map(([path, handler]) => [path, toNodeHandler(handler)]),
    );
    this.logger = options.logger ?? new McpStructuredLogger();

    const allowedHosts = options.allowedHosts ?? [
      "localhost",
      "127.0.0.1",
      "::1",
      "api",
    ];
    this.validateHost = hostHeaderValidation(allowedHosts);
    this.validateOrigin = originValidation(allowedHosts);
  }

  async handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<boolean> {
    const path = requestPath(request);
    if (path !== "/mcp" && !path.startsWith("/mcp/")) {
      return false;
    }

    const startedAt = process.hrtime.bigint();
    const requestId = headerValue(request, "x-request-id") ?? newMcpRequestId();
    const correlationId = headerValue(request, "x-correlation-id") ?? requestId;
    const sessionId = headerValue(request, "mcp-session-id");
    const bodyChunks: Buffer[] = [];
    let bodyBytes = 0;
    request.on("data", (chunk: Buffer | string) => {
      if (bodyBytes >= 64_000) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const remaining = 64_000 - bodyBytes;
      bodyChunks.push(buffer.subarray(0, remaining));
      bodyBytes += Math.min(buffer.length, remaining);
    });

    const baseContext: McpRequestLogContext = {
      requestId,
      correlationId,
      sessionId,
      route: path,
      httpMethod: request.method ?? "UNKNOWN",
      rpcMethod: null,
      rpcId: null,
      tool: null,
      resourceUri: null,
      startedAt,
      logger: this.logger,
    };
    request.on("end", () => {
      const rpc = rpcDetails(Buffer.concat(bodyChunks).toString("utf8"));
      baseContext.rpcMethod = rpc.method;
      baseContext.rpcId = rpc.id;
      baseContext.tool = rpc.tool;
      baseContext.resourceUri = rpc.resourceUri;
    });
    const logContext = () => {
      const details = requestDetails(
        request,
        Buffer.concat(bodyChunks).toString("utf8"),
      );
      return {
        request_id: requestId,
        correlation_id: correlationId,
        session_id: sessionId,
        ...details,
        ...statusDetails(response),
        duration_ms: Number(elapsedMilliseconds(startedAt).toFixed(3)),
        body_bytes: bodyBytes,
        body_truncated: bodyBytes >= 64_000,
      };
    };

    this.logger.info("mcp.request.received", {
      request_id: requestId,
      correlation_id: correlationId,
      session_id: sessionId,
      ...requestDetails(request, ""),
    });

    return mcpRequestContext.run(baseContext, async () => {
      if (
        !this.validateHost(request, response) ||
        !this.validateOrigin(request, response)
      ) {
        this.logger.warn("mcp.request.rejected", {
          ...logContext(),
          reason: "host_or_origin_validation",
        });
        return true;
      }

      if (path === "/mcp") {
        writeJson(response, 200, {
          name: "Ondaluz API",
          restBasePath: "/api",
          mcpBasePath: "/mcp",
          transport: "Streamable HTTP",
          authentication: "disabled-for-prototype",
          endpoints: MCP_ENDPOINTS,
        });
        this.logger.info("mcp.request.completed", logContext());
        return true;
      }

      const route = this.routes.get(path);
      if (!route) {
        writeJson(response, 404, { error: "Endpoint MCP não encontrado." });
        this.logger.warn("mcp.request.rejected", {
          ...logContext(),
          reason: "route_not_found",
        });
        return true;
      }

      try {
        await route(request, response);
        this.logger.info("mcp.request.completed", logContext());
        return true;
      } catch (error) {
        this.logger.error("mcp.request.failed", {
          ...logContext(),
          error: this.logger.errorDetails(error),
        });
        throw error;
      }
    });
  }

  async close(): Promise<void> {
    await Promise.all(this.handlers.map(([, handler]) => handler.close()));
  }
}

export function createMcpGateway(
  database: Queryable,
  options?: McpGatewayOptions,
  application?: ApplicationApi,
  openApi?: {
    document: OpenApiDocumentProvider;
    bridge: OpenApiBridgeOptions;
  },
): McpGateway {
  return new McpGateway(database, options, application, openApi);
}
