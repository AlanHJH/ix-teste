import { Controller, Get, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { DiagnosticsService } from "./diagnostics.service";
import { parsePageQuery } from "../pagination";
import {
  ApiInvalidRequest,
  ApiPagination,
  ApiRead,
  apiNumber,
  apiPageSchema,
  apiString,
} from "../openapi";

const diagnosticSchema = {
  type: "object" as const,
  description:
    "Execução de diagnóstico TR-143 enriquecida com cliente e topologia.",
  properties: {
    ts: apiString("Data e hora da execução."),
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
      type: "object",
      description: "Resumo e filtros disponíveis sobre a seleção completa.",
      additionalProperties: true,
    }),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: ["ts_desc", "ts_asc", "serial_asc", "download_mbps_desc"],
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
    description: "Início em ISO 8601.",
  })
  @ApiQuery({ name: "to", required: false, description: "Fim em ISO 8601." })
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
  ) {
    const pagination = parsePageQuery(page, pageSize, sort, {
      defaultSort: "ts_desc",
      allowedSorts: ["ts_desc", "ts_asc", "serial_asc", "download_mbps_desc"],
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
    });
  }
}
