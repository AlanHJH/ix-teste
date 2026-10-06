import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { MCP_ENDPOINTS } from "./mcp/catalog";
import { ApiRead } from "./openapi";
import { OpenApiCatalogService } from "./openapi-catalog.service";

@ApiTags("Sistema")
@Controller()
export class CatalogController {
  constructor(private readonly openApiCatalog: OpenApiCatalogService) {}

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
    const operations = this.openApiCatalog.restOperations();
    return {
      name: "Ondaluz API",
      rest: {
        basePath: "/api",
        operationCount: operations.length,
        endpoints: [...new Set(operations.map(({ path }) => path))],
        operations,
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
