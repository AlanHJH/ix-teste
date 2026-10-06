import { Controller, Get, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { DatabaseService } from "../database";
import { groupingScopeTypes, GroupingScopeType } from "../grouping-candidates";
import { paginate, parsePageQuery } from "../pagination";
import { OperationsQueries } from "../mcp/contexts/operations/application/operations-queries";
import { PostgresOperationsRepository } from "../mcp/contexts/operations/infrastructure/postgres-operations-repository";
import {
  ApiInvalidRequest,
  ApiPagination,
  ApiRead,
  apiInteger,
  apiNumber,
  apiPageSchema,
  apiString,
} from "../openapi";

const datasetLoadSchema = {
  type: "object" as const,
  description: "Execução de ingestão do dataset operacional.",
  properties: {
    load_id: apiString("Identificador da carga."),
    status: apiString("Estado da execução.", "completed"),
    started_at: apiString("Início da carga em ISO 8601."),
    finished_at: { ...apiString("Fim da carga em ISO 8601."), nullable: true },
    source: apiString("Origem do arquivo ou processo."),
    records: apiInteger("Quantidade de registros processados.", 1500),
  },
};

const groupingCandidateSchema = {
  type: "object" as const,
  description:
    "Escopo com concentração de sinais que pode merecer investigação.",
  properties: {
    candidateKey: apiString("Chave determinística usada para deduplicação."),
    scope: {
      type: "object" as const,
      description: "Tipo, identificador e caminho do escopo.",
    },
    signal: apiString("Sinal dominante que originou o candidato."),
    summary: apiString("Resumo da concentração observada."),
    affectedCpes: apiInteger("CPEs que atendem ao critério.", 42),
    totalCpes: apiInteger("CPEs ativas existentes no escopo.", 50),
    affectedPercent: apiNumber("Percentual afetado no escopo.", 84),
  },
};

const activeGroupingSchema = {
  type: "object" as const,
  description:
    "Incidente operacional ativo resultante de ação humana ou aprovação.",
  properties: {
    incident_id: apiString("Identificador do incidente."),
    status: apiString("Estado operacional.", "open"),
    severity: apiString("Severidade.", "high"),
    title: apiString("Título do agrupamento."),
    scope: { type: "object" as const, description: "Escopo persistido." },
    affected_cpes: apiInteger("CPEs ativas no escopo.", 42),
    opened_at: apiString("Abertura em ISO 8601."),
  },
};

@ApiTags("Operação da plataforma")
@Controller("operations")
export class OperationsController {
  private readonly operations: OperationsQueries;

  constructor(database: DatabaseService) {
    this.operations = new OperationsQueries(
      new PostgresOperationsRepository(database),
    );
  }

  @ApiRead({
    summary: "Listar cargas do dataset",
    description:
      "Exibe o histórico de ingestões que abasteceram o ambiente, permitindo acompanhar estado, origem e volume processado.",
    responseDescription: "Página do histórico de cargas.",
    schema: apiPageSchema(datasetLoadSchema, "Execuções de carga do dataset."),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: ["started_at_desc", "started_at_asc", "status_asc"],
    defaultSort: "started_at_desc",
  })
  @ApiInvalidRequest("Paginação ou ordenação inválida.")
  @Get("dataset-loads")
  async datasetLoads(
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "25",
    @Query("sort") sort = "started_at_desc",
  ) {
    const pagination = parsePageQuery(page, pageSize, sort, {
      defaultSort: "started_at_desc",
      allowedSorts: ["started_at_desc", "started_at_asc", "status_asc"],
    });
    const data = await this.operations.datasetLoads();
    const sorted = [...data].sort((left, right) => {
      if (pagination.sort === "status_asc") {
        return String(left.status).localeCompare(String(right.status));
      }
      const direction = pagination.sort.endsWith("_asc") ? 1 : -1;
      return (
        String(left.started_at).localeCompare(String(right.started_at)) *
        direction
      );
    });
    const offset = (pagination.page - 1) * pagination.pageSize;
    return paginate(
      sorted.slice(offset, offset + pagination.pageSize),
      sorted.length,
      pagination.page,
      pagination.pageSize,
    );
  }

  @ApiRead({
    summary: "Listar candidatos a agrupamento",
    description:
      "Consulta sinais agregados ainda candidatos a investigação. O filtro scopeType aceita somente os tipos de escopo conhecidos e o retorno é limitado aos 30 candidatos prioritários.",
    responseDescription: "Página de candidatos dos detectores.",
    schema: apiPageSchema(groupingCandidateSchema, "Candidatos a agrupamento."),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: ["priority_desc", "affected_cpes_desc", "affected_percent_desc"],
    defaultSort: "priority_desc",
    maximumPageSize: 30,
  })
  @ApiQuery({
    name: "scopeType",
    required: false,
    description: "Restringe candidatos ao tipo de escopo.",
    schema: { type: "string", enum: [...groupingScopeTypes] },
  })
  @ApiInvalidRequest("Filtro, paginação ou ordenação inválida.")
  @Get("grouping-candidates")
  async groupingCandidates(
    @Query("scopeType") scopeType = "",
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "25",
    @Query("sort") sort = "priority_desc",
  ) {
    const pagination = parsePageQuery(page, pageSize, sort, {
      defaultSort: "priority_desc",
      maximumPageSize: 30,
      allowedSorts: [
        "priority_desc",
        "affected_cpes_desc",
        "affected_percent_desc",
      ],
    });
    const selectedScope = groupingScopeTypes.includes(
      scopeType as GroupingScopeType,
    )
      ? (scopeType as GroupingScopeType)
      : undefined;
    const all = await this.operations.groupingCandidates({
      scopeType: selectedScope,
      limit: 30,
    });
    const sorted = [...all].sort((left, right) => {
      if (pagination.sort === "affected_cpes_desc") {
        return right.affectedCpes - left.affectedCpes;
      }
      if (pagination.sort === "affected_percent_desc") {
        return right.affectedPercent - left.affectedPercent;
      }
      return 0;
    });
    const offset = (pagination.page - 1) * pagination.pageSize;
    return paginate(
      sorted.slice(offset, offset + pagination.pageSize),
      sorted.length,
      pagination.page,
      pagination.pageSize,
    );
  }

  @ApiRead({
    summary: "Listar agrupamentos operacionais ativos",
    description:
      "Retorna incidentes ativos já reconhecidos pela operação, separados dos candidatos automáticos ainda não aprovados.",
    responseDescription: "Página de agrupamentos ativos.",
    schema: apiPageSchema(activeGroupingSchema, "Agrupamentos em tratamento."),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: ["severity_desc", "opened_at_desc", "opened_at_asc"],
    defaultSort: "severity_desc",
    maximumPageSize: 30,
  })
  @ApiQuery({
    name: "scopeType",
    required: false,
    description: "Restringe os agrupamentos ao tipo de escopo.",
    schema: { type: "string", enum: [...groupingScopeTypes] },
  })
  @ApiInvalidRequest("Filtro, paginação ou ordenação inválida.")
  @Get("active-groupings")
  async activeGroupings(
    @Query("scopeType") scopeType = "",
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "25",
    @Query("sort") sort = "severity_desc",
  ) {
    const pagination = parsePageQuery(page, pageSize, sort, {
      defaultSort: "severity_desc",
      maximumPageSize: 30,
      allowedSorts: ["severity_desc", "opened_at_desc", "opened_at_asc"],
    });
    const selectedScope = groupingScopeTypes.includes(
      scopeType as GroupingScopeType,
    )
      ? (scopeType as GroupingScopeType)
      : undefined;
    const all = await this.operations.activeGroupings({
      scopeType: selectedScope,
      limit: 30,
    });
    const offset = (pagination.page - 1) * pagination.pageSize;
    return paginate(
      all.slice(offset, offset + pagination.pageSize),
      all.length,
      pagination.page,
      pagination.pageSize,
    );
  }
}
