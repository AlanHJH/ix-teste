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

export interface McpGatewayOptions {
  allowedHosts?: string[];
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

export class McpGateway {
  private readonly handlers: ReadonlyArray<readonly [string, McpHandler]>;
  private readonly routes: ReadonlyMap<
    string,
    ReturnType<typeof toNodeHandler>
  >;
  private readonly validateHost: ReturnType<typeof hostHeaderValidation>;
  private readonly validateOrigin: ReturnType<typeof originValidation>;

  constructor(
    database: Queryable,
    options: McpGatewayOptions = {},
    application?: ApplicationApi,
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
    ];
    this.routes = new Map(
      this.handlers.map(([path, handler]) => [path, toNodeHandler(handler)]),
    );

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

    if (
      !this.validateHost(request, response) ||
      !this.validateOrigin(request, response)
    ) {
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
      return true;
    }

    const route = this.routes.get(path);
    if (!route) {
      writeJson(response, 404, { error: "Endpoint MCP não encontrado." });
      return true;
    }

    await route(request, response);
    return true;
  }

  async close(): Promise<void> {
    await Promise.all(this.handlers.map(([, handler]) => handler.close()));
  }
}

export function createMcpGateway(
  database: Queryable,
  options?: McpGatewayOptions,
  application?: ApplicationApi,
): McpGateway {
  return new McpGateway(database, options, application);
}
