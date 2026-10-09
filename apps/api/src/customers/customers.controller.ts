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
  OfflineAlertsQueryDto,
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

const customerEquipmentHistorySchema = {
  ...equipmentSchema,
  required: equipmentSchema.required.filter((field) => field !== "customer_id"),
};

const offlineAlertSchema = {
  type: "object" as const,
  description:
    "Sinal recente de chamado sem conexão associado a uma CPE ativa. Não confirma que a conexão esteja indisponível neste momento.",
  required: [
    "customer_id",
    "serial",
    "vendor",
    "model",
    "city",
    "neighborhood",
    "network",
    "ticket_id",
    "reported_at",
    "description",
    "resolution",
    "alert_status",
    "confirmed_offline",
  ],
  properties: {
    customer_id: apiString("Código do cliente.", "C198410"),
    serial: apiString("Serial da CPE ativa.", "KSTLD199FB78"),
    vendor: apiString("Fabricante da CPE.", "Kestrel"),
    model: apiString("Modelo da CPE.", "KX-3000"),
    city: apiString("Cidade da instalação.", "Serra Alta"),
    neighborhood: apiString("Bairro da instalação.", "Jardim Aurora"),
    network: apiString(
      "Caminho de rede resumido.",
      "OLT-2 · PON 1/7 · CTO-2-17-03",
    ),
    ticket_id: apiString("Chamado que originou o alerta.", "TN1-F3187553"),
    reported_at: apiDateTime("Data e hora do relato."),
    description: apiString("Descrição do relato do cliente."),
    resolution: apiString("Última orientação ou resolução registrada."),
    alert_status: {
      type: "string",
      enum: ["in_noc", "open", "recent"],
      description: "Estado operacional do último relato.",
    },
    confirmed_offline: {
      type: "boolean",
      description:
        "Sempre falso nesta fonte: o alerta precisa ser confirmado no diagnóstico.",
    },
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
    "preflight",
    "problemHistory",
    "activeIncidents",
    "recentTickets",
    "allTickets",
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
    preflight: {
      type: "object",
      description:
        "Resultado da verificação obrigatória antes da abertura do chamado.",
      required: [
        "infrastructureChecked",
        "measurementsChecked",
        "nocHistoryChecked",
        "relatedHistoryFound",
        "measurementStatus",
        "mainAdvice",
        "escalation",
      ],
      properties: {
        infrastructureChecked: {
          type: "boolean",
          description:
            "Indica que o caminho físico/lógico do cliente foi conferido.",
        },
        measurementsChecked: {
          type: "boolean",
          description: "Indica que as medições recentes foram avaliadas.",
        },
        nocHistoryChecked: {
          type: "boolean",
          description:
            "Indica que o histórico de problemas do NOC foi consultado.",
        },
        relatedHistoryFound: {
          type: "boolean",
          description:
            "Há pelo menos um problema do NOC relacionado ao caminho do cliente.",
        },
        measurementStatus: {
          type: "string",
          enum: ["related_history", "new_signal", "no_signal"],
          description:
            "Resultado das medições após a comparação com o histórico do NOC.",
        },
        mainAdvice: apiString("Principal orientação para o cliente."),
        escalation: {
          type: "object",
          required: ["required", "target", "reason"],
          properties: {
            required: {
              type: "boolean",
              description:
                "Indica se o atendimento deve ser encaminhado ao NOC.",
            },
            target: {
              type: "string",
              enum: ["NOC"],
              nullable: true,
              description: "Destino sugerido quando houver escalonamento.",
            },
            reason: apiString("Justificativa operacional do encaminhamento."),
          },
        },
      },
    },
    problemHistory: {
      type: "array",
      description:
        "Histórico de problemas do NOC cujo escopo alcança o caminho do cliente, incluindo itens resolvidos.",
      items: {
        type: "object",
        required: [
          "incidentId",
          "title",
          "status",
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
          incidentId: apiString("Identificador do problema no NOC."),
          title: apiString("Título do problema."),
          status: {
            type: "string",
            enum: ["open", "mitigating", "monitoring", "resolved"],
          },
          severity: {
            type: "string",
            enum: ["critical", "high", "medium", "low"],
          },
          category: apiString("Categoria técnica."),
          scope: {
            type: "object",
            description: "Escopo persistido do problema.",
          },
          affectedCpes: apiInteger("CPEs afetadas no problema."),
          confidence: apiNumber("Confiança entre 0 e 1."),
          probableCause: apiString("Causa provável registrada."),
          recommendedAction: apiString("Ação recomendada pelo NOC."),
          openedAt: apiDateTime("Data e hora de abertura."),
          openedBy: apiString("Autor do registro."),
          source: { type: "string", enum: ["agent", "manual"] },
          originTicketId: {
            ...apiString("Chamado que originou o problema."),
            nullable: true,
          },
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
    allTickets: {
      type: "array",
      description:
        "Todos os chamados do cliente, ordenados do mais recente para o mais antigo.",
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
    "deepAnalysis",
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
    deepAnalysis: {
      type: "object",
      description:
        "Análise consolidada por evidências e roteiro de investigação do atendimento.",
      required: [
        "headline",
        "summary",
        "causes",
        "path",
        "confirmed",
        "unknowns",
        "customerScript",
        "escalation",
        "model",
      ],
      properties: {
        headline: apiString("Conclusão inicial em linguagem operacional."),
        summary: apiString("Resumo da leitura cruzada do caso."),
        causes: apiArray(
          {
            type: "object",
            required: ["title", "likelihood", "evidence", "counterEvidence"],
            properties: {
              title: apiString("Hipótese considerada."),
              likelihood: {
                type: "string",
                enum: ["alta", "média", "baixa"],
              },
              evidence: apiArray(
                apiString("Evidência a favor."),
                "Evidências a favor da hipótese.",
              ),
              counterEvidence: apiArray(
                apiString("Evidência ausente ou contra."),
                "Evidências ausentes ou contra a hipótese.",
              ),
            },
          },
          "Causas prováveis ordenadas por relevância.",
        ),
        path: apiArray(
          {
            type: "object",
            required: ["step", "title", "action", "why", "decision"],
            properties: {
              step: apiInteger("Número da etapa."),
              title: apiString("Nome da etapa."),
              action: apiString("Ação segura para o atendente."),
              why: apiString("Por que a etapa reduz a incerteza."),
              decision: apiString("Como decidir depois da etapa."),
            },
          },
          "Caminho das pedras ordenado para conduzir o caso.",
        ),
        confirmed: apiArray(
          apiString("Fato confirmado pelo contexto."),
          "Fatos confirmados pelo contexto.",
        ),
        unknowns: apiArray(
          apiString("Lacuna que ainda precisa ser verificada."),
          "Lacunas que ainda precisam ser verificadas.",
        ),
        customerScript: apiString("Fala sugerida para o cliente."),
        escalation: apiString("Regra de encaminhamento."),
        model: { type: "string", enum: ["openai", "fallback"] },
      },
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
    summary: "Listar alertas recentes de clientes sem conexão",
    description:
      "Prioriza o último chamado Sem conexão de cada cliente ativo nos sete dias relativos ao período operacional. É um sinal para triagem e não uma confirmação automática de indisponibilidade.",
    responseDescription:
      "Página de alertas de conexão para a entrada do dashboard.",
    schema: apiPageSchema(offlineAlertSchema, "Página de alertas recentes."),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: ["alert_desc", "opened_at_desc"],
    defaultSort: "alert_desc",
    defaultPageSize: 8,
    maximumPageSize: 20,
  })
  @ApiInvalidRequest("Paginação ou ordenação inválida.")
  @Get("offline-alerts")
  offlineAlerts(@Query() params: OfflineAlertsQueryDto) {
    const pagination = parsePageQuery(
      params.page,
      params.pageSize,
      params.sort,
      {
        defaultPageSize: 8,
        maximumPageSize: 20,
        defaultSort: "alert_desc",
        allowedSorts: ["alert_desc", "opened_at_desc"],
      },
    );
    return this.customers.offlineAlerts(
      pagination.page,
      pagination.pageSize,
      pagination.sort,
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
          customerEquipmentHistorySchema,
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
