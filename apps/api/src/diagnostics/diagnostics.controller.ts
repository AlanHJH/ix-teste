import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import {
  DiagnosticsService,
  type DiagnosticFilter,
  type DiagnosticFilterKind,
} from "./diagnostics.service";
import { parsePageQuery } from "../pagination";
import {
  ApiInvalidRequest,
  ApiPagination,
  ApiRead,
  apiInteger,
  apiDateTime,
  apiNumber,
  apiPageSchema,
  apiString,
} from "../openapi";

const diagnosticFilterKinds = new Set<DiagnosticFilterKind>([
  "serial",
  "customer",
  "vendor",
  "model",
  "state",
  "requestedBy",
  "diagnostic",
  "olt",
  "pon",
  "cto",
  "testServer",
]);

export function parseDiagnosticFilters(
  input: string | string[] | undefined,
): DiagnosticFilter[] {
  const values = Array.isArray(input) ? input : input ? [input] : [];
  return values.slice(0, 12).flatMap((entry) => {
    const separator = entry.indexOf(":");
    if (separator < 1) return [];
    const kind = entry.slice(0, separator) as DiagnosticFilterKind;
    const value = entry
      .slice(separator + 1)
      .trim()
      .slice(0, 160);
    return diagnosticFilterKinds.has(kind) && value ? [{ kind, value }] : [];
  });
}

const diagnosticSchema = {
  type: "object" as const,
  description:
    "Execução de diagnóstico TR-143 enriquecida com cliente e topologia.",
  properties: {
    ts: apiDateTime("Data e hora da execução."),
    serial: apiString("Serial da CPE.", "KSTLD199FB78"),
    requested_by: apiString("Origem da solicitação.", "NOC"),
    diagnostic: apiString("Tipo do diagnóstico.", "DownloadDiagnostics"),
    state: apiString("Estado retornado pela CPE.", "Completed"),
    download_mbps: { ...apiNumber("Download em Mbps.", 204.6), nullable: true },
    upload_mbps: { ...apiNumber("Upload em Mbps.", 143.9), nullable: true },
    test_server: apiString("Servidor de teste.", "speed.ondaluz.net.br"),
    customer_id: apiString("Código do cliente.", "C169781"),
    model: apiString("Modelo da CPE.", "KX-3000"),
    plan_mbps: apiNumber("Plano contratado em Mbps.", 300),
    olt: apiString("OLT.", "OLT-2"),
    pon: apiString("PON.", "1/7"),
    cto: apiString("CTO.", "CTO-2-17-03"),
  },
  required: [
    "ts",
    "serial",
    "requested_by",
    "diagnostic",
    "state",
    "download_mbps",
    "upload_mbps",
    "test_server",
    "customer_id",
    "model",
    "plan_mbps",
    "olt",
    "pon",
    "cto",
  ],
};

const diagnosticMetaSchema = {
  type: "object" as const,
  description: "Resumo da seleção completa e filtros existentes.",
  required: ["summary", "filters"],
  properties: {
    summary: {
      type: "object",
      required: [
        "total",
        "completed",
        "errors",
        "avg_download_mbps",
        "avg_upload_mbps",
      ],
      properties: {
        total: apiInteger("Total de diagnósticos filtrados."),
        completed: apiInteger("Diagnósticos concluídos."),
        errors: apiInteger("Diagnósticos em estado diferente de Completed."),
        avg_download_mbps: {
          ...apiNumber("Download médio dos testes concluídos."),
          nullable: true,
        },
        avg_upload_mbps: {
          ...apiNumber("Upload médio dos testes concluídos."),
          nullable: true,
        },
      },
    },
    filters: {
      type: "object",
      required: ["states", "requested_by"],
      properties: {
        states: { type: "array", items: apiString("Estado disponível.") },
        requested_by: {
          type: "array",
          items: apiString("Solicitante disponível."),
        },
      },
    },
  },
};

@ApiTags("Diagnósticos")
@Controller("diagnostics")
export class DiagnosticsController {
  constructor(private readonly diagnostics: DiagnosticsService) {}

  @ApiRead({
    summary: "Consultar diagnósticos TR-143",
    description:
      "Lista testes remotos de download/upload. Timeout e ausência de resposta não equivalem a velocidade zero. meta resume toda a seleção filtrada.",
    responseDescription: "Diagnósticos e resumo da seleção.",
    schema: apiPageSchema(diagnosticSchema, "Página de diagnósticos TR-143.", {
      ...diagnosticMetaSchema,
    }),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: [
      "ts_desc",
      "ts_asc",
      "serial_asc",
      "serial_desc",
      "state_asc",
      "state_desc",
      "download_mbps_desc",
      "download_mbps_asc",
      "olt_asc",
      "olt_desc",
      "failures_first",
    ],
    defaultSort: "ts_desc",
  })
  @ApiQuery({ name: "q", required: false, description: "Busca textual geral." })
  @ApiQuery({
    name: "state",
    required: false,
    description: "Estado do teste ou all.",
  })
  @ApiQuery({
    name: "requestedBy",
    required: false,
    description: "Solicitante ou all.",
  })
  @ApiQuery({ name: "serial", required: false, description: "Serial exato." })
  @ApiQuery({
    name: "customerId",
    required: false,
    description: "Cliente exato.",
  })
  @ApiQuery({
    name: "diagnostic",
    required: false,
    description: "Tipo de diagnóstico.",
  })
  @ApiQuery({
    name: "from",
    required: false,
    description: "Data inicial inclusiva no formato YYYY-MM-DD ou ISO 8601.",
  })
  @ApiQuery({
    name: "to",
    required: false,
    description: "Data final inclusiva no formato YYYY-MM-DD ou ISO 8601.",
  })
  @ApiQuery({
    name: "filter",
    required: false,
    isArray: true,
    description:
      "Filtros facetados repetíveis no formato campo:valor. Valores do mesmo campo são combinados com OU; campos diferentes, com E.",
    schema: {
      type: "array",
      items: { type: "string" },
      example: ["state:Completed", "olt:OLT-2"],
    },
  })
  @ApiInvalidRequest("Filtro ou paginação inválida.")
  @Get()
  list(
    @Query("q") query = "",
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "25",
    @Query("sort") sort = "ts_desc",
    @Query("state") state = "all",
    @Query("requestedBy") requestedBy = "all",
    @Query("serial") serial = "",
    @Query("customerId") customerId = "",
    @Query("diagnostic") diagnostic = "",
    @Query("from") from = "",
    @Query("to") to = "",
    @Query("filter") filter?: string | string[],
  ) {
    const pagination = parsePageQuery(page, pageSize, sort, {
      defaultSort: "ts_desc",
      allowedSorts: [
        "ts_desc",
        "ts_asc",
        "serial_asc",
        "serial_desc",
        "state_asc",
        "state_desc",
        "download_mbps_desc",
        "download_mbps_asc",
        "olt_asc",
        "olt_desc",
        "failures_first",
      ],
    });
    return this.diagnostics.list({
      query,
      ...pagination,
      state,
      requestedBy,
      serial,
      customerId,
      diagnostic,
      from,
      to,
      filters: parseDiagnosticFilters(filter),
    });
  }

  @ApiRead({
    summary: "Listar opções para filtros facetados dos diagnósticos",
    description:
      "Sugere seriais, clientes, fabricantes, modelos, estados, solicitantes, tipos, servidor de teste e topologia para o autocomplete de múltipla escolha da tela de Diagnósticos.",
    responseDescription: "Página de opções de filtro com contagens.",
    schema: apiPageSchema(
      {
        type: "object",
        properties: {
          kind: apiString("Campo filtrável.", "state"),
          value: apiString("Valor exato enviado no filtro.", "Completed"),
          label: apiString("Rótulo apresentado ao usuário.", "Concluído"),
          detail: apiString("Tipo da opção.", "Estado do teste"),
          count: apiInteger("Quantidade de diagnósticos.", 6180),
        },
      },
      "Página de opções para os filtros de diagnósticos.",
    ),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: ["relevance", "label_asc", "label_desc"],
    defaultSort: "relevance",
    defaultPageSize: 20,
    maximumPageSize: 50,
  })
  @ApiQuery({ name: "q", required: false, description: "Texto digitado." })
  @ApiQuery({
    name: "kind",
    required: false,
    description:
      "Restringe as sugestões a uma coluna específica da tabela, preservando o autocomplete de múltipla escolha.",
    enum: [...diagnosticFilterKinds],
  })
  @Get("filter-options")
  filterOptions(
    @Query("q") query = "",
    @Query("kind") kind = "",
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "20",
    @Query("sort") sort = "relevance",
  ) {
    if (kind && !diagnosticFilterKinds.has(kind as DiagnosticFilterKind)) {
      throw new BadRequestException("Tipo de filtro de diagnóstico inválido");
    }
    const pagination = parsePageQuery(page, pageSize, sort, {
      defaultPageSize: 20,
      maximumPageSize: 50,
      defaultSort: "relevance",
      allowedSorts: ["relevance", "label_asc", "label_desc"],
    });
    return this.diagnostics.filterOptions(
      query,
      pagination.page,
      pagination.pageSize,
      pagination.sort,
      kind as DiagnosticFilterKind | "",
    );
  }
}
