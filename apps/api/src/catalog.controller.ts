import { Controller, Get } from "@nestjs/common";
import { MCP_ENDPOINTS } from "./mcp/catalog";

@Controller()
export class CatalogController {
  @Get()
  catalog() {
    return {
      name: "Ondaluz API",
      rest: {
        basePath: "/api",
        endpoints: [
          "/api/network/overview",
          "/api/network/incidents",
          "/api/network/topology/devices",
          "/api/customers",
          "/api/customers/:customerId/support",
          "/api/tickets",
          "/api/incidents",
          "/api/incidents/options",
          "/api/diagnostics",
          "/api/investigations",
          "/api/investigations/trigger/metrics",
          "/api/investigations/:investigationId/retry",
          "/api/investigations/:investigationId/review",
        ],
      },
      mcp: {
        basePath: "/mcp",
        transport: "Streamable HTTP",
        endpoints: MCP_ENDPOINTS,
      },
      health: "/health",
    };
  }
}
