import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import { DatabaseService } from "./database";
import { ApiRead, apiErrorSchema, apiString } from "./openapi";

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
          additionalProperties: { type: "string" },
        },
        dataset: {
          type: "object",
          description: "Estado da carga principal.",
          additionalProperties: true,
        },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: "API disponível, mas o dataset ainda não está pronto.",
    schema: apiErrorSchema,
  })
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
