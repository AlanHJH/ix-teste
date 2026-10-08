import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBody,
  ApiNotFoundResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import {
  ApiInvalidRequest,
  ApiPagination,
  ApiRead,
  ApiWrite,
  apiArray,
  apiDateTime,
  apiErrorSchema,
  apiInteger,
  apiNumber,
  apiPageSchema,
  apiString,
} from "../openapi";
import { parsePageQuery } from "../pagination";
import {
  CreateIncidentInput,
  IncidentOptionType,
  IncidentsService,
} from "./incidents.service";

const operationalIncidentSchema = {
  type: "object" as const,
  description:
    "Incidente operacional criado por operador ou aprovado após investigação.",
  properties: {
    incident_id: apiString("Identificador do incidente.", "INC-82F1D19A"),
    investigation_id: {
      ...apiString("Investigação que originou a proposta."),
      nullable: true,
    },
    status: {
      type: "string" as const,
      enum: ["open", "mitigating", "monitoring", "resolved"],
      description: "Etapa operacional atual.",
    },
    category: apiString(
      "Categoria técnica normalizada.",
      "optical_degradation",
    ),
    severity: {
      type: "string" as const,
      enum: ["critical", "high", "medium", "low"],
      description: "Severidade definida para priorização.",
    },
    title: apiString("Título operacional."),
    scope: {
      type: "object" as const,
      description:
        "Escopo confirmado, incluindo tipo, identificador e caminho topológico quando aplicável.",
      required: ["type", "identifier", "olt", "pon", "cto"],
      properties: {
        type: {
          type: "string",
          enum: [
            "park",
            "olt",
            "pon",
            "cto",
            "customer",
            "firmware",
            "equipment",
            "region",
          ],
        },
        identifier: apiString("Identificador ou rótulo do escopo."),
        olt: { ...apiString("OLT do escopo."), nullable: true },
        pon: { ...apiString("PON do escopo."), nullable: true },
        cto: { ...apiString("CTO do escopo."), nullable: true },
      },
    },
    affected_cpes: apiInteger("Quantidade de CPEs ativas no escopo.", 42),
    confidence: apiNumber("Confiança entre 0 e 1.", 0.94),
    probable_cause: apiString("Causa provável ou hipótese operacional."),
    recommended_action: apiString("Próxima ação recomendada."),
    evidence: apiArray(
      {
        type: "object",
        required: ["source", "reference", "summary"],
        properties: {
          source: apiString("Origem da evidência."),
          reference: apiString("Identificador ou filtro rastreável."),
          summary: apiString("Resumo da evidência."),
        },
      },
      "Evidências usadas para sustentar o incidente.",
    ),
    opened_at: apiDateTime("Data e hora de abertura em ISO 8601."),
    opened_by: apiString("Operador ou agente que propôs o incidente."),
    source: apiString("Origem do registro.", "manual"),
    origin_ticket_id: { ...apiString("Chamado N1 vinculado."), nullable: true },
  },
  required: [
    "incident_id",
    "investigation_id",
    "status",
    "category",
    "severity",
    "title",
    "scope",
    "affected_cpes",
    "confidence",
    "probable_cause",
    "recommended_action",
    "evidence",
    "opened_at",
    "opened_by",
    "source",
    "origin_ticket_id",
  ],
};

@ApiTags("Incidentes operacionais")
@Controller("incidents")
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @ApiRead({
    summary: "Listar incidentes operacionais ativos",
    description:
      "Consulta incidentes abertos, em mitigação ou monitoramento. Pode restringir por tipo de escopo e sempre devolve envelope paginado.",
    responseDescription: "Página de incidentes operacionais.",
    schema: apiPageSchema(
      operationalIncidentSchema,
      "Incidentes em tratamento.",
    ),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: ["severity_desc", "opened_at_desc", "opened_at_asc"],
    defaultSort: "severity_desc",
  })
  @ApiQuery({
    name: "scopeType",
    required: false,
    description:
      "Tipo do escopo registrado, como olt, pon, cto, firmware ou equipment.",
  })
  @ApiInvalidRequest("Filtro, paginação ou ordenação inválida.")
  @Get()
  list(
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "25",
    @Query("sort") sort = "severity_desc",
    @Query("scopeType") scopeType = "",
  ) {
    const pagination = parsePageQuery(page, pageSize, sort, {
      defaultSort: "severity_desc",
      allowedSorts: ["severity_desc", "opened_at_desc", "opened_at_asc"],
    });
    return this.incidents.list(
      pagination.page,
      pagination.pageSize,
      pagination.sort,
      scopeType,
    );
  }

  @ApiRead({
    summary: "Listar opções para definir um escopo",
    description:
      "Fornece opções pesquisáveis para o formulário de abertura manual. PON depende de OLT; CTO depende de OLT e PON; cliente exige ao menos dois caracteres de busca.",
    responseDescription:
      "Página de opções compatíveis com o contexto informado.",
    schema: apiPageSchema(
      {
        type: "object",
        required: ["value", "label"],
        properties: {
          value: apiString("Valor persistido."),
          label: apiString("Rótulo exibido ao operador."),
        },
      },
      "Opções do seletor de escopo.",
      {
        type: "object",
        properties: { type: apiString("Tipo de opção solicitado.", "olt") },
        required: ["type"],
      },
    ),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: ["value_asc", "value_desc"],
    defaultSort: "value_asc",
    defaultPageSize: 40,
    maximumPageSize: 50,
  })
  @ApiQuery({
    name: "type",
    required: false,
    description: "Catálogo desejado.",
    schema: {
      type: "string",
      enum: [
        "olt",
        "pon",
        "cto",
        "customer",
        "firmware",
        "equipment",
        "region",
      ],
      default: "olt",
    },
  })
  @ApiQuery({
    name: "q",
    required: false,
    description: "Prefixo pesquisado no catálogo selecionado.",
  })
  @ApiQuery({
    name: "olt",
    required: false,
    description: "OLT pai, obrigatória para opções de PON e CTO.",
  })
  @ApiQuery({
    name: "pon",
    required: false,
    description: "PON pai, obrigatória para opções de CTO.",
  })
  @ApiInvalidRequest("Tipo, dependência, paginação ou ordenação inválida.")
  @Get("options")
  options(
    @Query("type") type = "olt",
    @Query("q") query = "",
    @Query("olt") olt = "",
    @Query("pon") pon = "",
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "40",
    @Query("sort") sort = "value_asc",
  ) {
    const pagination = parsePageQuery(page, pageSize, sort, {
      defaultPageSize: 40,
      maximumPageSize: 50,
      defaultSort: "value_asc",
      allowedSorts: ["value_asc", "value_desc"],
    });
    return this.incidents.options({
      type: type as IncidentOptionType,
      query,
      olt,
      pon,
      ...pagination,
    });
  }

  @ApiWrite({
    summary: "Abrir incidente operacional",
    description:
      "Cria um agrupamento manual validado contra as CPEs ativas do escopo. Se originTicketId for enviado, vincula e encerra o encaminhamento N1 correspondente.",
    responseDescription: "Incidente operacional criado.",
    schema: operationalIncidentSchema,
    created: true,
  })
  @ApiBody({
    description: "Dados informados e validados pelo operador do NOC.",
    schema: {
      type: "object",
      required: [
        "openedBy",
        "title",
        "severity",
        "scopeType",
        "probableCause",
        "recommendedAction",
      ],
      properties: {
        openedBy: {
          ...apiString("Nome ou identificador do operador.", "noc-alan"),
          minLength: 2,
          maxLength: 100,
        },
        title: {
          ...apiString("Título de 5 a 160 caracteres."),
          minLength: 5,
          maxLength: 160,
        },
        severity: {
          type: "string",
          enum: ["critical", "high", "medium", "low"],
          default: "medium",
        },
        scopeType: {
          type: "string",
          enum: [
            "park",
            "olt",
            "pon",
            "cto",
            "customer",
            "firmware",
            "equipment",
            "region",
          ],
          default: "pon",
        },
        identifier: apiString(
          "Cliente, serial, firmware, equipamento ou região, conforme scopeType.",
        ),
        olt: apiString("OLT do escopo quando aplicável."),
        pon: apiString("PON do escopo quando aplicável."),
        cto: apiString("CTO do escopo quando aplicável."),
        probableCause: {
          ...apiString("Hipótese do operador, entre 5 e 600 caracteres."),
          minLength: 5,
          maxLength: 600,
        },
        recommendedAction: {
          ...apiString("Próxima ação, entre 5 e 600 caracteres."),
          minLength: 5,
          maxLength: 600,
        },
        originTicketId: {
          ...apiString("Chamado N1 escalado a vincular."),
          nullable: true,
        },
      },
    },
  })
  @ApiInvalidRequest("Corpo inválido ou escopo sem CPEs ativas.")
  @ApiNotFoundResponse({
    description: "Chamado N1 de origem não encontrado ou já tratado.",
    schema: apiErrorSchema,
  })
  @Post()
  create(@Body() body: Partial<CreateIncidentInput>) {
    return this.incidents.create({
      openedBy: body.openedBy ?? "",
      title: body.title ?? "",
      severity: body.severity ?? "medium",
      scopeType: body.scopeType ?? "pon",
      identifier: body.identifier ?? "",
      olt: body.olt ?? "",
      pon: body.pon ?? "",
      cto: body.cto ?? "",
      probableCause: body.probableCause ?? "",
      recommendedAction: body.recommendedAction ?? "",
      originTicketId: body.originTicketId ?? null,
    });
  }

  @ApiWrite({
    summary: "Resolver incidente operacional",
    description:
      "Encerra um incidente que esteja aberto, em mitigação ou em monitoramento. Incidentes já resolvidos não são alterados novamente.",
    responseDescription: "Identificador e estado final do incidente.",
    schema: {
      type: "object",
      properties: {
        incident_id: apiString("Incidente encerrado."),
        status: { type: "string", enum: ["resolved"] },
      },
    },
  })
  @ApiParam({
    name: "incidentId",
    description: "Identificador do incidente.",
    example: "INC-82F1D19A",
  })
  @ApiBody({
    description: "Novo estado permitido.",
    schema: {
      type: "object",
      required: ["status"],
      properties: { status: { type: "string", enum: ["resolved"] } },
    },
  })
  @ApiInvalidRequest("Somente o estado resolved é aceito.")
  @ApiNotFoundResponse({
    description: "Incidente não encontrado ou já encerrado.",
    schema: apiErrorSchema,
  })
  @Patch(":incidentId/status")
  close(
    @Param("incidentId") incidentId: string,
    @Body() body: { status?: "resolved" },
  ) {
    return this.incidents.close(incidentId, body.status ?? "resolved");
  }
}
