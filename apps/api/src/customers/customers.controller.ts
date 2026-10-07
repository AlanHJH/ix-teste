import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  ApiBody,
  ApiNotFoundResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { CustomersService } from "./customers.service";
import { N1AdvisorService, N1ChatMessage } from "./n1-advisor.service";
import { parsePageQuery } from "../pagination";
import {
  ApiInvalidRequest,
  ApiPagination,
  ApiRead,
  apiArray,
  apiErrorSchema,
  apiInteger,
  apiNullableString,
  apiPageSchema,
  apiString,
} from "../openapi";

const equipmentSchema = {
  type: "object" as const,
  description: "CPE associada ao cliente em um período do histórico.",
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
    installed_at: apiString("Data de instalação."),
    removed_at: apiNullableString("Data de retirada."),
  },
};

const customerSummarySchema = {
  type: "object" as const,
  description: "Resumo consolidado de um cliente para busca e seleção.",
  properties: {
    customer_id: apiString("Código único do cliente.", "C169781"),
    customer_status: apiString("Situação cadastral.", "active"),
    customer_since: apiString("Data de início do cliente."),
    cancelled_at: apiNullableString("Data de cancelamento."),
    active_serial: apiNullableString("Serial da CPE ativa.", "KSTLD199FB78"),
    city: apiString("Cidade da instalação mais recente."),
    neighborhood: apiString("Bairro da instalação mais recente."),
    plan_mbps: apiInteger("Plano atual ou mais recente em Mbps.", 300),
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
  list(
    @Query("q") query = "",
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "25",
    @Query("sort") sort = "relevance",
    @Query("status") status = "active",
    @Query("filter") filter?: string | string[],
  ) {
    const pagination = parsePageQuery(page, pageSize, sort, {
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
    });
    const selectedStatus =
      status === "all" || status === "removed" ? status : "active";
    return this.customers.list(
      query,
      pagination.page,
      pagination.pageSize,
      selectedStatus,
      pagination.sort,
      parseInventoryFilters(filter),
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
  filterOptions(
    @Query("q") query = "",
    @Query("status") status = "active",
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "12",
    @Query("sort") sort = "relevance",
  ) {
    const selectedStatus =
      status === "all" || status === "removed" ? status : "active";
    const pagination = parsePageQuery(page, pageSize, sort, {
      defaultPageSize: 12,
      maximumPageSize: 50,
      defaultSort: "relevance",
      allowedSorts: ["relevance", "label_asc", "label_desc"],
    });
    return this.customers.filterOptions(
      query,
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
  search(
    @Query("q") query = "",
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "8",
    @Query("sort") sort = "customer_id_asc",
    @Query("status") status = "all",
  ) {
    const pagination = parsePageQuery(page, pageSize, sort, {
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
    });
    const selectedStatus =
      status === "active" || status === "cancelled" ? status : "all";
    return this.customers.search(
      query,
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
      properties: {
        customer_id: apiString("Código do cliente."),
        customer_status: apiString("Situação cadastral."),
        active_equipment: { ...equipmentSchema, nullable: true },
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
  get(@Param("customerId") customerId: string) {
    return this.customers.get(customerId);
  }

  @ApiRead({
    summary: "Montar contexto operacional do atendimento N1",
    description:
      "Consolida cadastro, CPE ativa, telemetria recente, diagnóstico, chamados e agrupamentos. A hipótese apoia a triagem, não confirma causa.",
    responseDescription: "Perfil completo para atendimento N1.",
    schema: {
      type: "object",
      properties: {
        customer: { type: "object", additionalProperties: true },
        equipment: { type: "object", additionalProperties: true },
        metrics: { type: "object", additionalProperties: true },
        decision: { type: "object", additionalProperties: true },
        activeIncidents: apiArray(
          { type: "object", additionalProperties: true },
          "Agrupamentos ativos relacionados.",
        ),
        recentTickets: apiArray(
          { type: "object", additionalProperties: true },
          "Chamados recentes.",
        ),
      },
    },
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
  support(@Param("customerId") customerId: string) {
    return this.customers.getSupportProfile(customerId);
  }

  @ApiRead({
    summary: "Obter orientação do copiloto para o atendimento N1",
    description:
      "Recebe o relato atual e até oito mensagens recentes. Sugere perguntas ou encaminhamento seguro sem alterar rede, cadastro ou chamado.",
    responseDescription: "Orientação estruturada do copiloto.",
    schema: { type: "object", additionalProperties: true },
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
              content: apiString("Conteúdo da mensagem."),
            },
          },
          "Até oito mensagens recentes.",
        ),
      },
      example: { message: "A luz LOS está piscando em vermelho.", history: [] },
    },
  })
  @ApiInvalidRequest("Mensagem inválida.")
  @Post(":customerId/n1-chat")
  n1Chat(
    @Param("customerId") customerId: string,
    @Body()
    body: {
      message?: string;
      history?: N1ChatMessage[];
    },
  ) {
    const safeBody = body ?? {};
    const message =
      typeof safeBody.message === "string" ? safeBody.message : "";
    const history = Array.isArray(safeBody.history)
      ? safeBody.history
          .filter(
            (item) =>
              item &&
              (item.role === "user" || item.role === "assistant") &&
              typeof item.content === "string",
          )
          .slice(-8)
      : [];
    return this.n1Advisor.chat(customerId, message, history);
  }
}
