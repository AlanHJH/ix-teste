import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { MCP_ENDPOINTS } from "./mcp/catalog";
import { ApiRead, apiArray, apiInteger, apiString } from "./openapi";
import { OpenApiCatalogService } from "./openapi-catalog.service";
import { Public } from "./auth/auth.guard";

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
      required: ["name", "rest", "documentation", "mcp", "health"],
      properties: {
        name: apiString("Nome da plataforma.", "Ondaluz API"),
        rest: {
          type: "object",
          required: ["basePath", "operationCount", "endpoints", "operations"],
          properties: {
            basePath: apiString("Prefixo REST.", "/api"),
            operationCount: apiInteger("Quantidade de operações REST."),
            endpoints: apiArray(
              apiString("Caminho REST."),
              "Caminhos REST publicados.",
            ),
            operations: {
              type: "array",
              description: "Operações REST descobertas no documento OpenAPI.",
              items: {
                type: "object",
                required: [
                  "method",
                  "path",
                  "operationId",
                  "summary",
                  "readOnly",
                  "dashboardResource",
                ],
                properties: {
                  method: apiString("Método HTTP."),
                  path: apiString("Caminho da operação."),
                  operationId: apiString("Identificador estável da operação."),
                  summary: apiString("Resumo da operação."),
                  readOnly: { type: "boolean" },
                  dashboardResource: { type: "boolean" },
                },
              },
            },
          },
        },
        documentation: {
          type: "object",
          required: ["swagger", "openapiJson", "openapiYaml"],
          properties: {
            swagger: apiString("Swagger UI."),
            openapiJson: apiString("OpenAPI JSON."),
            openapiYaml: apiString("OpenAPI YAML."),
          },
        },
        mcp: {
          type: "object",
          required: ["basePath", "transport", "endpoints"],
          properties: {
            basePath: apiString("Prefixo MCP.", "/mcp"),
            transport: apiString("Transporte MCP.", "Streamable HTTP"),
            endpoints: { type: "array", items: { type: "object" } },
          },
        },
        health: apiString("Healthcheck da aplicação.", "/health"),
      },
    },
  })
  @Public()
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
