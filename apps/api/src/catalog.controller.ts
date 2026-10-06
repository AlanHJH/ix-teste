import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { MCP_ENDPOINTS } from "./mcp/catalog";
import { ApiRead } from "./openapi";

@ApiTags("Sistema")
@Controller()
export class CatalogController {
  @ApiRead({
    summary: "Obter catálogo das interfaces REST e MCP",
    description:
      "Ponto de descoberta compacto com documentação, REST, MCP e healthcheck. Para geração automática de integrações, prefira /api/openapi.json.",
    responseDescription: "Catálogo das interfaces publicadas.",
    schema: {
      type: "object",
      description: "Links canônicos e endpoints de alto nível da plataforma.",
      additionalProperties: true,
    },
  })
  @Get()
  catalog() {
    return {
      name: "Ondaluz API",
      rest: {
        basePath: "/api",
        endpoints: [
          "/api/network/overview",
          "/api/dashboard/compose",
          "/api/network/incidents",
          "/api/network/topology/devices",
          "/api/customers",
          "/api/customers/search",
          "/api/customers/:customerId",
          "/api/customers/:customerId/support",
          "/api/tickets",
          "/api/tickets/:ticketId",
          "/api/tickets/noc-queue",
          "/api/incidents",
          "/api/incidents/options",
          "/api/diagnostics",
          "/api/inventory",
          "/api/inventory/:serial",
          "/api/inventory/topology",
          "/api/telemetry/informs",
          "/api/telemetry/daily-metrics",
          "/api/operations/dataset-loads",
          "/api/operations/grouping-candidates",
          "/api/operations/active-groupings",
          "/api/investigations",
          "/api/investigations/config",
          "/api/investigations/trigger/metrics",
          "/api/investigations/:investigationId/retry",
          "/api/investigations/:investigationId/review",
        ],
      },
      documentation: {
        swagger: "/api/docs",
        openapiJson: "/api/openapi.json",
        openapiYaml: "/api/openapi.yaml",
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
