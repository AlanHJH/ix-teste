import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  ApiBody,
  ApiNotFoundResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { CustomersService } from "./customers.service";
import { N1AdvisorService } from "./n1-advisor.service";
import { parsePageQuery } from "../pagination";
import { N1ChatDto } from "../contracts/input.dto";
import { CustomerIdParamDto } from "../contracts/params.dto";
import {
  CustomersFilterOptionsQueryDto,
  CustomersListQueryDto,
  CustomersSearchQueryDto,
} from "../contracts/query.dto";
import {
  ApiInvalidRequest,
  ApiPagination,
  ApiRead,
  apiArray,
  apiDate,
  apiDateTime,
  apiErrorSchema,
  apiInteger,
  apiNumber,
  apiNullableString,
  apiPageSchema,
  apiString,
} from "../openapi";

const equipmentSchema = {
  type: "object" as const,
  description: "CPE associada ao cliente em um período do histórico.",
  required: [
    "serial",
    "customer_id",
    "vendor",
    "model",
    "hw_revision",
    "software_version",
    "plan_mbps",
    "olt",
    "pon_port",
    "cto",
    "city",
    "neighborhood",
    "status",
    "installed_at",
    "removed_at",
  ],
  properties: {
    serial: apiString("Serial único.", "KSTLD199FB78"),
    customer_id: apiString("Código do cliente.", "C169781"),
    vendor: apiString("Fabricante.", "Kestrel"),
    model: apiString("Modelo.", "KX-3000"),
    hw_revision: apiString("Revisão de hardware.", "1.2"),
    software_version: apiString("Firmware.", "2.4.1"),
    plan_mbps: apiInteger("Plano em Mbps.", 300),
    olt: apiString("OLT.", "OLT-2"),
    pon_port: apiString("PON.", "1/7"),
    cto: apiString("CTO.", "CTO-2-17-03"),
    city: apiString("Cidade.", "Serra Alta"),
    neighborhood: apiString("Bairro.", "Jardim Aurora"),
    status: apiString("Estado do equipamento.", "active"),
    installed_at: apiDate("Data de instalação."),
    removed_at: apiNullableString("Data de retirada."),
  },
};

const customerSummarySchema = {
  type: "object" as const,
  description: "Resumo consolidado de um cliente para busca e seleção.",
  required: [
    "customer_id",
    "customer_status",
    "customer_since",
    "cancelled_at",
    "active_serial",
    "city",
    "neighborhood",
    "plan_mbps",
  ],
  properties: {
    customer_id: apiString("Código único do cliente.", "C169781"),
    customer_status: apiString("Situação cadastral.", "active"),
    customer_since: apiDate("Data de início do cliente."),
    cancelled_at: { ...apiDate("Data de cancelamento."), nullable: true },
    active_serial: apiNullableString("Serial da CPE ativa.", "KSTLD199FB78"),
    city: apiString("Cidade da instalação mais recente."),
    neighborhood: apiString("Bairro da instalação mais recente."),
    plan_mbps: apiInteger("Plano atual ou mais recente em Mbps.", 300),
  },
};

const supportProfileSchema = {
  type: "object" as const,
  description: "Contexto consolidado consumido pelo atendimento N1.",
  required: [
    "customer",
    "equipment",
    "metrics",
    "decision",
    "activeIncidents",
    "recentTickets",
  ],
  properties: {
    customer: {
      type: "object",
      required: ["id", "city", "neighborhood"],
      properties: {
        id: apiString("Código do cliente.", "C545968"),
        city: apiString("Cidade da instalação.", "Serra Alta"),
        neighborhood: apiString("Bairro da instalação.", "Jardim Aurora"),
      },
    },
    equipment: {
      type: "object",
      required: [
        "serial",
        "vendor",
        "model",
        "hardware",
        "firmware",
        "planMbps",
        "previousPlanMbps",
        "planSince",
        "network",
      ],
      properties: {
        serial: apiString("Serial da CPE.", "KSTLD199FB78"),
        vendor: apiString("Fabricante.", "Kestrel"),
        model: apiString("Modelo.", "KX-3000"),
        hardware: apiString("Revisão de hardware.", "1.2"),
        firmware: apiString("Firmware.", "2.4.1"),
        planMbps: apiInteger("Plano contratado em Mbps.", 300),
        previousPlanMbps: {
          ...apiInteger("Plano anterior em Mbps.", 100),
          nullable: true,
        },
        planSince: apiDate("Data de início do plano."),
        network: apiString(
          "Caminho lógico resumido.",
          "OLT-2 · PON 1/7 · CTO-2-17-03",
        ),
      },
    },
    metrics: {
      type: "object",
      required: [
        "mem_min_pct",
        "reboot_count",
        "lan_min_mbps",
        "optical_rx_min_dbm",
        "optical_low_days",
        "wifi_signal_raw",
        "last_day",
        "diagnostic",
      ],
      properties: {
        mem_min_pct: {
          ...apiNumber("Menor memória livre em percentual.", 8.2),
          nullable: true,
        },
        reboot_count: apiInteger("Reinícios observados na janela."),
        lan_min_mbps: {
          ...apiNumber("Menor negociação LAN em Mbps.", 100),
          nullable: true,
        },
        optical_rx_min_dbm: {
          ...apiNumber("Menor RX óptico em dBm.", -27.2),
          nullable: true,
        },
        optical_low_days: apiInteger("Dias com RX abaixo do limite."),
        wifi_signal_raw: {
          ...apiNumber("Sinal Wi-Fi médio na unidade bruta.", -70),
          nullable: true,
        },
        last_day: apiDate("Último dia disponível."),
        diagnostic: {
          type: "object",
          nullable: true,
          required: ["ts", "state", "download_mbps", "upload_mbps", "ratio"],
          properties: {
            ts: apiDateTime("Data e hora do último diagnóstico."),
            state: apiString("Estado do diagnóstico.", "Completed"),
            download_mbps: {
              ...apiNumber("Download em Mbps.", 204.6),
              nullable: true,
            },
            upload_mbps: {
              ...apiNumber("Upload em Mbps.", 143.9),
              nullable: true,
            },
            ratio: {
              ...apiNumber("Razão entre download e plano.", 0.68),
              nullable: true,
            },
          },
        },
      },
    },
    decision: {
      type: "object",
      required: [
        "issue",
        "confidence",
        "action",
        "actionLabel",
        "sayToCustomer",
        "operatorSteps",
        "reasons",
        "relatedProblemId",
        "relatedProblemTitle",
        "relatedProblemKind",
      ],
      properties: {
        issue: apiString("Hipótese ou problema predominante."),
        confidence: { type: "string", enum: ["Alta", "Média", "Baixa"] },
        action: {
          type: "string",
          enum: ["escalar_noc", "agendar_visita", "resolver_telefone"],
        },
        actionLabel: apiString("Rótulo operacional da ação."),
        sayToCustomer: apiString(
          "Orientação em linguagem adequada ao cliente.",
        ),
        operatorSteps: apiArray(
          apiString("Passo operacional."),
          "Passos para o atendente.",
        ),
        reasons: apiArray(
          apiString("Motivo baseado nos sinais."),
          "Razões da decisão.",
        ),
        relatedProblemId: {
          ...apiString("Identificador do problema relacionado."),
          nullable: true,
        },
        relatedProblemTitle: {
          ...apiString("Título do problema relacionado."),
          nullable: true,
        },
        relatedProblemKind: {
          type: "string",
          enum: ["incident", "signal"],
          nullable: true,
        },
      },
    },
    activeIncidents: {
      type: "array",
      description: "Incidentes ativos cujo escopo alcança o cliente.",
      items: {
        type: "object",
        required: [
          "incidentId",
          "title",
          "severity",
          "category",
          "scope",
          "affectedCpes",
          "confidence",
          "probableCause",
          "recommendedAction",
          "openedAt",
          "openedBy",
          "source",
          "originTicketId",
        ],
        properties: {
          incidentId: apiString("Identificador do incidente."),
          title: apiString("Título operacional."),
          severity: {
            type: "string",
            enum: ["critical", "high", "medium", "low"],
          },
          category: apiString("Categoria técnica."),
          scope: { type: "object", description: "Escopo persistido." },
          affectedCpes: apiInteger("CPEs afetadas."),
          confidence: apiNumber("Confiança entre 0 e 1."),
          probableCause: apiString("Causa provável."),
          recommendedAction: apiString("Ação recomendada."),
          openedAt: apiDateTime("Data e hora de abertura."),
          openedBy: apiString("Autor do registro."),
          source: { type: "string", enum: ["agent", "manual"] },
          originTicketId: {
            ...apiString("Chamado de origem."),
            nullable: true,
          },
        },
      },
    },
    recentTickets: {
      type: "array",
      description: "Até cinco chamados recentes do cliente.",
      items: {
        type: "object",
        required: [
          "ticket_id",
          "opened_at",
          "category",
          "description",
          "resolution",
        ],
        properties: {
          ticket_id: apiString("Identificador do chamado."),
          opened_at: apiDateTime("Data e hora de abertura."),
          category: apiString("Categoria do chamado."),
          description: apiString("Relato registrado."),
          resolution: apiString("Desfecho registrado."),
        },
      },
    },
  },
};

const n1AdvisorReplySchema = {
  type: "object" as const,
  description: "Orientação estruturada para o atendente N1.",
  required: [
    "assistantMessage",
    "nextSteps",
    "options",
    "documentation",
    "disposition",
    "model",
  ],
  properties: {
    assistantMessage: apiString("Mensagem sugerida ao atendente."),
    nextSteps: apiArray(
      apiString("Próximo passo seguro."),
      "Até quatro próximos passos.",
    ),
    options: apiArray(
      {
        type: "object",
        required: ["id", "label", "description"],
        properties: {
          id: apiString("Identificador da opção."),
          label: apiString("Rótulo da opção."),
          description: apiString("Descrição da opção."),
        },
      },
      "Até três opções de encaminhamento.",
    ),
    documentation: apiString("Texto pronto para registrar no chamado."),
    disposition: {
      type: "string",
      enum: ["continue", "resolve_phone", "escalate_noc", "schedule_visit"],
    },
    model: { type: "string", enum: ["openai", "fallback"] },
  },
};

export type InventoryFilterKind =
  | "customer"
  | "serial"
  | "vendor"
  | "model"
  | "firmware"
  | "plan"
  | "olt"
  | "cto"
  | "city"
  | "neighborhood";

export type InventoryFilter = { kind: InventoryFilterKind; value: string };

const inventoryFilterKinds = new Set<InventoryFilterKind>([
  "customer",
  "serial",
  "vendor",
  "model",
  "firmware",
  "plan",
  "olt",
  "cto",
  "city",
  "neighborhood",
]);

export function parseInventoryFilters(
  input: string | string[] | undefined,
): InventoryFilter[] {
  const values = Array.isArray(input) ? input : input ? [input] : [];
  return values.slice(0, 12).flatMap((entry) => {
    const separator = entry.indexOf(":");
    if (separator < 1) return [];
    const kind = entry.slice(0, separator) as InventoryFilterKind;
    const value = entry
      .slice(separator + 1)
      .trim()
      .slice(0, 80);
    return inventoryFilterKinds.has(kind) && value ? [{ kind, value }] : [];
  });
}

@ApiTags("Clientes")
@Controller("customers")
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly n1Advisor: N1AdvisorService,
  ) {}

  @ApiRead({
    summary: "Listar equipamentos associados a clientes",
    description:
      "Lista CPEs com dados cadastrais e de rede. filter aceita até 12 valores no formato campo:valor para a exploração facetada.",
    responseDescription: "Página de equipamentos associados a clientes.",
    schema: apiPageSchema(equipmentSchema, "Página de CPEs e seus clientes."),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: [
      "relevance",
      "customer_id_asc",
      "customer_id_desc",
      "serial_asc",
      "serial_desc",
      "equipment_asc",
      "equipment_desc",
      "firmware_plan_asc",
      "firmware_plan_desc",
      "installed_at_desc",
      "plan_mbps_desc",
      "plan_mbps_asc",
      "topology_asc",
      "topology_desc",
      "status_asc",
      "status_desc",
    ],
    defaultSort: "relevance",
  })
  @ApiQuery({ name: "q", required: false, description: "Busca textual geral." })
  @ApiQuery({
    name: "status",
    required: false,
    description: "Estado do equipamento.",
    schema: {
      type: "string",
      enum: ["active", "removed", "all"],
      default: "active",
    },
  })
  @ApiQuery({
    name: "filter",
    required: false,
    isArray: true,
    description:
      "Filtro repetível campo:valor. Campos: customer, serial, vendor, model, firmware, plan, olt, cto, city e neighborhood.",
    schema: {
      type: "array",
      items: { type: "string" },
      example: ["vendor:Kestrel", "plan:300"],
    },
  })
  @ApiInvalidRequest("Filtro, paginação ou ordenação inválida.")
  @Get()
  list(@Query() params: CustomersListQueryDto) {
    const pagination = parsePageQuery(
      params.page,
      params.pageSize,
      params.sort,
      {
        defaultSort: "relevance",
        maximumPageSize: 100,
        allowedSorts: [
          "relevance",
          "customer_id_asc",
          "customer_id_desc",
          "serial_asc",
          "serial_desc",
          "equipment_asc",
          "equipment_desc",
          "firmware_plan_asc",
          "firmware_plan_desc",
          "installed_at_desc",
          "plan_mbps_desc",
          "plan_mbps_asc",
          "topology_asc",
          "topology_desc",
          "status_asc",
          "status_desc",
        ],
      },
    );
    const selectedStatus =
      params.status === "all" || params.status === "removed"
        ? params.status
        : "active";
    return this.customers.list(
      params.q,
      pagination.page,
      pagination.pageSize,
      selectedStatus,
      pagination.sort,
      parseInventoryFilters(params.filter),
    );
  }

  @ApiRead({
    summary: "Listar opções para filtros facetados do inventário",
    description:
      "Retorna valores e contagens disponíveis por campo, respeitando busca textual e estado. Alimenta os seletores da tela Cadastros.",
    responseDescription: "Opções de filtro agrupadas por campo.",
    schema: apiPageSchema(
      {
        type: "object",
        properties: {
          kind: apiString("Campo ao qual a opção pertence.", "vendor"),
          value: apiString("Valor exato usado no filtro.", "Kestrel"),
          label: apiString("Rótulo exibido na interface.", "Kestrel"),
          detail: apiString("Contexto complementar da opção.", "Fabricante"),
          count: apiInteger("Quantidade de equipamentos correspondentes.", 420),
        },
      },
      "Página de opções para os filtros facetados.",
    ),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: ["relevance", "label_asc", "label_desc"],
    defaultSort: "relevance",
    defaultPageSize: 12,
    maximumPageSize: 50,
  })
  @ApiQuery({ name: "q", required: false, description: "Busca textual atual." })
  @ApiQuery({
    name: "status",
    required: false,
    description: "Estado do equipamento.",
    schema: {
      type: "string",
      enum: ["active", "removed", "all"],
      default: "active",
    },
  })
  @Get("filter-options")
  filterOptions(@Query() params: CustomersFilterOptionsQueryDto) {
    const selectedStatus =
      params.status === "all" || params.status === "removed"
        ? params.status
        : "active";
    const pagination = parsePageQuery(
      params.page,
      params.pageSize,
      params.sort,
      {
        defaultPageSize: 12,
        maximumPageSize: 50,
        defaultSort: "relevance",
        allowedSorts: ["relevance", "label_asc", "label_desc"],
      },
    );
    return this.customers.filterOptions(
      params.q,
      selectedStatus,
      pagination.page,
      pagination.pageSize,
      pagination.sort,
    );
  }

  @ApiRead({
    summary: "Pesquisar clientes consolidados",
    description:
      "Retorna uma linha por cliente. active_serial identifica a CPE atual; o histórico completo fica na rota de detalhe.",
    responseDescription: "Página de clientes.",
    schema: apiPageSchema(
      customerSummarySchema,
      "Página de clientes consolidados.",
    ),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: [
      "customer_id_asc",
      "customer_id_desc",
      "customer_since_desc",
      "plan_mbps_desc",
      "plan_mbps_asc",
    ],
    defaultSort: "customer_id_asc",
    defaultPageSize: 8,
    maximumPageSize: 50,
  })
  @ApiQuery({
    name: "q",
    required: false,
    description: "Busca por cliente, serial ou localidade.",
  })
  @ApiQuery({
    name: "status",
    required: false,
    description: "Situação cadastral consolidada.",
    schema: {
      type: "string",
      enum: ["active", "cancelled", "all"],
      default: "all",
    },
  })
  @ApiInvalidRequest("Filtro, paginação ou ordenação inválida.")
  @Get("search")
  search(@Query() params: CustomersSearchQueryDto) {
    const pagination = parsePageQuery(
      params.page,
      params.pageSize,
      params.sort,
      {
        defaultPageSize: 8,
        maximumPageSize: 50,
        defaultSort: "customer_id_asc",
        allowedSorts: [
          "customer_id_asc",
          "customer_id_desc",
          "customer_since_desc",
          "plan_mbps_desc",
          "plan_mbps_asc",
        ],
      },
    );
    const selectedStatus =
      params.status === "active" || params.status === "cancelled"
        ? params.status
        : "all";
    return this.customers.search(
      params.q,
      pagination.page,
      pagination.pageSize,
      pagination.sort,
      selectedStatus,
    );
  }

  @ApiRead({
    summary: "Obter cadastro e histórico de equipamentos do cliente",
    description:
      "Retorna o cadastro consolidado, a CPE ativa e CPEs removidas, diferenciando equipamento atual de histórico.",
    responseDescription: "Cliente encontrado.",
    schema: {
      type: "object",
      required: ["customer", "equipment_history"],
      properties: {
        customer: {
          type: "object",
          required: [
            "customer_id",
            "customer_status",
            "customer_since",
            "cancelled_at",
          ],
          properties: {
            customer_id: apiString("Código do cliente."),
            customer_status: apiString("Situação cadastral."),
            customer_since: apiDate("Data de início do cliente."),
            cancelled_at: {
              ...apiDate("Data de cancelamento."),
              nullable: true,
            },
          },
        },
        equipment_history: apiArray(
          equipmentSchema,
          "Equipamentos do mais recente para o mais antigo.",
        ),
      },
    },
    dashboardResource: true,
  })
  @ApiParam({
    name: "customerId",
    description: "Código do cliente.",
    example: "C169781",
  })
  @ApiNotFoundResponse({
    description: "Cliente não encontrado.",
    schema: apiErrorSchema,
  })
  @Get(":customerId")
  get(@Param() params: CustomerIdParamDto) {
    return this.customers.get(params.customerId);
  }

  @ApiRead({
    summary: "Montar contexto operacional do atendimento N1",
    description:
      "Consolida cadastro, CPE ativa, telemetria recente, diagnóstico, chamados e agrupamentos. A hipótese apoia a triagem, não confirma causa.",
    responseDescription: "Perfil completo para atendimento N1.",
    schema: supportProfileSchema,
    dashboardResource: true,
  })
  @ApiParam({
    name: "customerId",
    description: "Código do cliente ativo.",
    example: "C545968",
  })
  @ApiNotFoundResponse({
    description: "Cliente ativo não encontrado.",
    schema: apiErrorSchema,
  })
  @Get(":customerId/support")
  support(@Param() params: CustomerIdParamDto) {
    return this.customers.getSupportProfile(params.customerId);
  }

  @ApiRead({
    summary: "Obter orientação do copiloto para o atendimento N1",
    description:
      "Recebe o relato atual e até oito mensagens recentes. Sugere perguntas ou encaminhamento seguro sem alterar rede, cadastro ou chamado.",
    responseDescription: "Orientação estruturada do copiloto.",
    schema: n1AdvisorReplySchema,
    created: true,
  })
  @ApiParam({
    name: "customerId",
    description: "Código do cliente ativo.",
    example: "C545968",
  })
  @ApiBody({
    description: "Mensagem atual e histórico curto da conversa.",
    schema: {
      type: "object",
      required: ["message"],
      properties: {
        message: apiString(
          "Relato do cliente ou resposta à pergunta anterior.",
        ),
        history: apiArray(
          {
            type: "object",
            properties: {
              role: { type: "string", enum: ["user", "assistant"] },
              content: {
                ...apiString("Conteúdo da mensagem."),
                minLength: 1,
                maxLength: 1200,
              },
            },
            required: ["role", "content"],
          },
          "Até oito mensagens recentes.",
        ),
      },
      example: { message: "A luz LOS está piscando em vermelho.", history: [] },
    },
  })
  @ApiInvalidRequest("Mensagem inválida.")
  @Post(":customerId/n1-chat")
  n1Chat(@Param() params: CustomerIdParamDto, @Body() body: N1ChatDto) {
    return this.n1Advisor.chat(
      params.customerId,
      body.message,
      body.history ?? [],
    );
  }
}
