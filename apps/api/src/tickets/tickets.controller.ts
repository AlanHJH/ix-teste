import {
  BadRequestException,
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
  TicketsService,
  type TicketFilter,
  type TicketFilterKind,
} from "./tickets.service";
import { parsePageQuery } from "../pagination";
import {
  ApiInvalidRequest,
  ApiPagination,
  ApiRead,
  ApiWrite,
  apiErrorSchema,
  apiInteger,
  apiNumber,
  apiDateTime,
  apiNullableString,
  apiPageSchema,
  apiString,
} from "../openapi";
import {
  TicketsFilterOptionsQueryDto,
  TicketsListQueryDto,
  TicketsQueueQueryDto,
} from "../contracts/query.dto";
import { CreateTicketDto, NocStatusDto } from "../contracts/input.dto";
import { TicketIdParamDto } from "../contracts/params.dto";

const ticketFilterKinds = new Set<TicketFilterKind>([
  "ticket",
  "customer",
  "category",
  "resolution",
  "channel",
  "nocStatus",
  "source",
  "openedBy",
  "olt",
  "pon",
  "cto",
]);

export function parseTicketFilters(
  input: string | string[] | undefined,
): TicketFilter[] {
  const values = Array.isArray(input) ? input : input ? [input] : [];
  return values.slice(0, 12).flatMap((entry) => {
    const separator = entry.indexOf(":");
    if (separator < 1) return [];
    const kind = entry.slice(0, separator) as TicketFilterKind;
    const value = entry
      .slice(separator + 1)
      .trim()
      .slice(0, 160);
    return ticketFilterKinds.has(kind) && value ? [{ kind, value }] : [];
  });
}

const ticketSchema = {
  type: "object" as const,
  description:
    "Chamado de atendimento enriquecido com localização e topologia.",
  properties: {
    ticket_id: apiString("Identificador do chamado.", "T000123"),
    opened_at: apiDateTime("Data e hora de abertura."),
    customer_id: apiString("Código do cliente.", "C169781"),
    channel: apiString("Canal de entrada.", "Telefone"),
    category: apiString("Categoria.", "Sem conexão"),
    description: apiString("Relato registrado."),
    resolution: apiString("Desfecho registrado.", "Escalado para NOC"),
    closed_at: { ...apiDateTime("Data de encerramento."), nullable: true },
    handling_minutes: {
      ...apiNumber("Tempo de tratamento em minutos.", 21.5),
      nullable: true,
    },
    source: apiString("Origem do chamado.", "dataset"),
    opened_by: apiNullableString("Operador responsável."),
    related_problem_id: apiNullableString("Agrupamento relacionado."),
    noc_status: apiString("Estado na fila NOC.", "pending"),
    source_payload: {
      type: "object",
      additionalProperties: true,
      description:
        "Payload bruto/contextual da origem, disponível no detalhe do chamado.",
    },
    olt: apiString("OLT atual do cliente.", "OLT-2"),
    pon: apiString("PON atual.", "1/7"),
    cto: apiString("CTO atual.", "CTO-2-17-03"),
  },
  required: [
    "ticket_id",
    "opened_at",
    "customer_id",
    "channel",
    "category",
    "description",
    "resolution",
    "closed_at",
    "handling_minutes",
    "source",
    "opened_by",
    "related_problem_id",
    "noc_status",
    "olt",
    "pon",
    "cto",
  ],
};

const ticketSummaryMetaSchema = {
  type: "object" as const,
  description: "Indicadores calculados sobre todos os chamados filtrados.",
  required: [
    "total",
    "technical",
    "escalated",
    "visits",
    "avg_handling_minutes",
  ],
  properties: {
    total: apiInteger("Total de chamados filtrados."),
    technical: apiInteger("Chamados de categorias técnicas."),
    escalated: apiInteger("Chamados escalados ao NOC."),
    visits: apiInteger("Chamados com visita técnica agendada."),
    avg_handling_minutes: {
      ...apiNumber("Tempo médio de tratamento em minutos."),
      nullable: true,
    },
  },
};

const ticketFilterMetaSchema = {
  type: "object" as const,
  description: "Valores disponíveis para filtros globais.",
  required: ["categories", "resolutions", "channels"],
  properties: {
    categories: { type: "array", items: apiString("Categoria disponível.") },
    resolutions: { type: "array", items: apiString("Resolução disponível.") },
    channels: { type: "array", items: apiString("Canal disponível.") },
  },
};

@ApiTags("Chamados")
@Controller("tickets")
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @ApiRead({
    summary: "Listar chamados escalados ao NOC",
    description:
      "Retorna chamados N1 recebidos ou em andamento. Chamados encerrados ou vinculados a agrupamentos ficam fora da fila ativa.",
    responseDescription: "Fila operacional do NOC.",
    schema: apiPageSchema(ticketSchema, "Página da fila NOC.", {
      type: "object",
      description: "Contagens de recebidos e em andamento.",
      required: ["summary"],
      properties: {
        summary: {
          type: "object",
          required: ["received", "inProgress"],
          properties: {
            received: apiInteger("Chamados recebidos aguardando atendimento."),
            inProgress: apiInteger("Chamados em andamento."),
          },
        },
      },
    }),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: ["opened_at_asc", "opened_at_desc", "status_asc"],
    defaultSort: "opened_at_asc",
    defaultPageSize: 100,
  })
  @ApiInvalidRequest("Paginação inválida.")
  @Get("noc-queue")
  nocQueue(@Query() params: TicketsQueueQueryDto) {
    const pagination = parsePageQuery(
      params.page,
      params.pageSize,
      params.sort,
      {
        defaultPageSize: 100,
        defaultSort: "opened_at_asc",
        allowedSorts: ["opened_at_asc", "opened_at_desc", "status_asc"],
      },
    );
    return this.tickets.nocQueue(
      pagination.page,
      pagination.pageSize,
      pagination.sort,
    );
  }

  @ApiRead({
    summary: "Listar chamados de atendimento",
    description:
      "Consulta chamados históricos e criados pelo N1. meta contém indicadores e opções disponíveis para os filtros.",
    responseDescription: "Chamados e resumo da seleção.",
    schema: apiPageSchema(ticketSchema, "Página de chamados.", {
      type: "object",
      description: "Resumo e filtros da seleção completa.",
      required: ["summary", "filters"],
      properties: {
        summary: ticketSummaryMetaSchema,
        filters: ticketFilterMetaSchema,
      },
    }),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: [
      "opened_at_desc",
      "opened_at_asc",
      "customer_id_asc",
      "customer_id_desc",
      "category_asc",
      "category_desc",
      "resolution_asc",
      "resolution_desc",
      "handling_minutes_desc",
      "handling_minutes_asc",
      "noc_priority_desc",
    ],
    defaultSort: "opened_at_desc",
  })
  @ApiQuery({ name: "q", required: false, description: "Busca textual geral." })
  @ApiQuery({
    name: "category",
    required: false,
    description: "Categoria exata ou all.",
  })
  @ApiQuery({
    name: "resolution",
    required: false,
    description: "Resolução exata ou all.",
  })
  @ApiQuery({
    name: "channel",
    required: false,
    description: "Canal exato ou all.",
  })
  @ApiQuery({
    name: "customerId",
    required: false,
    description: "Cliente exato.",
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
      example: ["nocStatus:pending", "olt:OLT-2"],
    },
  })
  @ApiInvalidRequest("Filtro ou paginação inválida.")
  @Get()
  list(@Query() params: TicketsListQueryDto) {
    const pagination = parsePageQuery(
      params.page,
      params.pageSize,
      params.sort,
      {
        defaultSort: "opened_at_desc",
        allowedSorts: [
          "opened_at_desc",
          "opened_at_asc",
          "customer_id_asc",
          "customer_id_desc",
          "category_asc",
          "category_desc",
          "resolution_asc",
          "resolution_desc",
          "handling_minutes_desc",
          "handling_minutes_asc",
          "noc_priority_desc",
        ],
      },
    );
    return this.tickets.list({
      query: params.q,
      ...pagination,
      category: params.category,
      resolution: params.resolution,
      channel: params.channel,
      customerId: params.customerId,
      from: params.from,
      to: params.to,
      filters: parseTicketFilters(params.filter),
    });
  }

  @ApiRead({
    summary: "Listar opções para filtros facetados dos chamados",
    description:
      "Sugere identificadores, clientes, categorias, resoluções, situação NOC, origem, responsável e topologia para o autocomplete de múltipla escolha da tela de Tickets.",
    responseDescription: "Página de opções de filtro com contagens.",
    schema: apiPageSchema(
      {
        type: "object",
        properties: {
          kind: apiString("Campo filtrável.", "category"),
          value: apiString("Valor exato enviado no filtro.", "Lentidão"),
          label: apiString("Rótulo apresentado ao usuário.", "Lentidão"),
          detail: apiString("Tipo da opção.", "Categoria"),
          count: apiInteger("Quantidade de chamados.", 3944),
        },
      },
      "Página de opções para os filtros de chamados.",
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
    enum: [...ticketFilterKinds],
  })
  @Get("filter-options")
  filterOptions(@Query() params: TicketsFilterOptionsQueryDto) {
    if (
      params.kind &&
      !ticketFilterKinds.has(params.kind as TicketFilterKind)
    ) {
      throw new BadRequestException("Tipo de filtro de ticket inválido");
    }
    const pagination = parsePageQuery(
      params.page,
      params.pageSize,
      params.sort,
      {
        defaultPageSize: 20,
        maximumPageSize: 50,
        defaultSort: "relevance",
        allowedSorts: ["relevance", "label_asc", "label_desc"],
      },
    );
    return this.tickets.filterOptions(
      params.q,
      pagination.page,
      pagination.pageSize,
      pagination.sort,
      params.kind as TicketFilterKind | "",
    );
  }

  @ApiRead({
    summary: "Obter chamado pelo identificador",
    description:
      "Retorna o chamado com os dados topológicos atuais do cliente.",
    responseDescription: "Chamado encontrado.",
    schema: ticketSchema,
    dashboardResource: true,
  })
  @ApiParam({
    name: "ticketId",
    description: "Identificador do chamado.",
    example: "T000123",
  })
  @ApiNotFoundResponse({
    description: "Chamado não encontrado.",
    schema: apiErrorSchema,
  })
  @Get(":ticketId")
  get(@Param() params: TicketIdParamDto) {
    return this.tickets.get(params.ticketId);
  }

  @ApiWrite({
    summary: "Registrar o desfecho de um atendimento N1",
    description:
      "Cria um chamado para cliente ativo. Escalonamentos podem referenciar um agrupamento que o backend valida antes de gravar.",
    responseDescription: "Chamado criado.",
    schema: ticketSchema,
    created: true,
  })
  @ApiBody({
    description: "Dados validados do atendimento.",
    schema: {
      type: "object",
      required: [
        "customerId",
        "openedBy",
        "category",
        "description",
        "outcome",
      ],
      properties: {
        customerId: apiString("Cliente ativo.", "C545968"),
        openedBy: apiString("Atendente responsável.", "Marina Costa"),
        category: apiString("Categoria.", "Sem conexão"),
        description: apiString("Relato e passos executados."),
        outcome: {
          type: "string",
          enum: ["resolver_telefone", "escalar_noc", "agendar_visita"],
        },
        relatedProblemId: apiNullableString("Agrupamento relacionado."),
        sourcePayload: {
          type: "object",
          additionalProperties: true,
          description: "Payload bruto/contextual recebido da origem.",
        },
      },
    },
  })
  @ApiInvalidRequest("Dados ou vínculo inválidos.")
  @Post()
  create(@Body() body: CreateTicketDto) {
    return this.tickets.create({
      customerId: body.customerId,
      openedBy: body.openedBy,
      category: body.category,
      description: body.description,
      outcome: body.outcome,
      relatedProblemId: body.relatedProblemId ?? null,
      sourcePayload: body.sourcePayload,
    });
  }

  @ApiWrite({
    summary: "Atualizar o estado de um chamado na fila do NOC",
    description:
      "Move um escalonamento para em andamento ou encerra o atendimento, preservando o histórico.",
    responseDescription: "Chamado atualizado.",
    schema: ticketSchema,
  })
  @ApiParam({ name: "ticketId", description: "Identificador do chamado N1." })
  @ApiBody({
    schema: {
      type: "object",
      required: ["status"],
      properties: {
        status: { type: "string", enum: ["in_progress", "closed"] },
      },
    },
  })
  @ApiInvalidRequest("Transição inválida.")
  @Patch(":ticketId/noc-status")
  updateNocStatus(
    @Param() params: TicketIdParamDto,
    @Body() body: NocStatusDto,
  ) {
    return this.tickets.updateNocStatus(params.ticketId, body.status);
  }
}
