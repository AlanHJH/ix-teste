import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import { DatabaseService } from "./database";
import { ApiRead, apiErrorSchema, apiString, apiDateTime } from "./openapi";
import { Public } from "./auth/auth.guard";

@ApiTags("Sistema")
@Controller()
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @ApiRead({
    summary: "Verificar disponibilidade da API e do dataset",
    description:
      "Confirma que o processo está disponível e que a carga principal terminou. Retorna 503 enquanto o dataset ainda está sendo carregado.",
    responseDescription: "API pronta para consultas.",
    schema: {
      type: "object",
      properties: {
        status: apiString("Estado geral da API.", "ok"),
        service: apiString("Nome do serviço.", "ondaluz-api"),
        interfaces: {
          type: "object",
          description: "Pontos de entrada publicados pela aplicação.",
          required: ["rest", "mcp", "openapi", "swagger"],
          properties: {
            rest: apiString("Prefixo das rotas REST.", "/api"),
            mcp: apiString("Prefixo do catálogo MCP.", "/mcp"),
            openapi: apiString("Documento OpenAPI JSON.", "/api/openapi.json"),
            swagger: apiString("Interface Swagger UI.", "/api/docs"),
          },
        },
        dataset: {
          type: "object",
          description: "Estado da carga principal.",
          nullable: true,
          required: ["status", "finished_at"],
          properties: {
            status: apiString("Estado da carga.", "complete"),
            finished_at: {
              ...apiDateTime("Conclusão da carga em ISO 8601."),
              nullable: true,
            },
          },
        },
      },
      required: ["status", "service", "interfaces", "dataset"],
    },
  })
  @ApiServiceUnavailableResponse({
    description: "API disponível, mas o dataset ainda não está pronto.",
    schema: apiErrorSchema,
    example: {
      statusCode: 503,
      message: { status: "loading", dataset: null },
      error: "Service Unavailable",
    },
  })
  @Public()
  @Get("health")
  async health() {
    const result = await this.database.query<{
      status: string;
      finished_at: string;
    }>(
      "SELECT status, finished_at FROM dataset_loads WHERE dataset_key='ondaluz-2026-08'",
    );
    const dataset = result.rows[0] ?? null;
    if (dataset?.status !== "complete") {
      throw new ServiceUnavailableException({ status: "loading", dataset });
    }
    return {
      status: "ok",
      service: "ondaluz-api",
      interfaces: {
        rest: "/api",
        mcp: "/mcp",
        openapi: "/api/openapi.json",
        swagger: "/api/docs",
      },
      dataset,
    };
  }
}
