import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import {
  mcpJson,
  pageInput,
  readOnlyAnnotations,
  registerAboutResource,
} from "../../../shared/presentation/mcp.js";

const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

const closeAnnotations = {
  ...writeAnnotations,
  destructiveHint: true,
  idempotentHint: true,
} as const;

export type ApplicationApi = {
  health(): Promise<unknown>;
  overview(): Promise<unknown>;
  topology(olt?: string, pon?: string): Promise<unknown>;
  topologyPath(input: {
    query: string;
    page: number;
    pageSize: number;
    sort: string;
  }): Promise<unknown>;
  topologyDevices(input: {
    olt: string;
    pon: string;
    cto: string;
    page: number;
    pageSize: number;
    sort: string;
  }): Promise<unknown>;
  detectedGroupings(input: {
    page: number;
    pageSize: number;
    sort: string;
  }): Promise<unknown>;
  detectedGrouping(id: string): Promise<unknown>;
  closeDetectedGrouping(id: string): Promise<unknown>;
  customerSupport(customerId: string): Promise<unknown>;
  customerFilterOptions(input: {
    query: string;
    status: "active" | "removed" | "all";
    page: number;
    pageSize: number;
    sort: string;
  }): Promise<unknown>;
  n1Chat(input: {
    customerId: string;
    message: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
  }): Promise<unknown>;
  nocQueue(input: {
    page: number;
    pageSize: number;
    sort: string;
  }): Promise<unknown>;
  ticketTriage(ticketId: string): Promise<unknown>;
  ticketTriageConfig(): unknown;
  retryTicketTriage(ticketId: string): Promise<unknown>;
  createTicket(input: Record<string, unknown>): Promise<unknown>;
  updateTicketStatus(
    ticketId: string,
    status: "in_progress" | "closed",
  ): Promise<unknown>;
  activeIncidents(input: {
    page: number;
    pageSize: number;
    sort: string;
    scopeType: string;
  }): Promise<unknown>;
  incidentOptions(input: {
    type:
      "olt" | "pon" | "cto" | "customer" | "firmware" | "equipment" | "region";
    query: string;
    olt: string;
    pon: string;
    page: number;
    pageSize: number;
    sort: string;
  }): Promise<unknown>;
  createIncident(input: Record<string, unknown>): Promise<unknown>;
  closeIncident(incidentId: string): Promise<unknown>;
  investigations(input: {
    page: number;
    pageSize: number;
    sort: string;
    status: string;
  }): Promise<unknown>;
  investigationConfig(): unknown;
  triggerInvestigations(
    kind: "groupings" | "scheduled" | "manual",
    objective?: string,
  ): Promise<unknown>;
  retryInvestigation(investigationId: string): Promise<unknown>;
  reviewInvestigation(input: {
    investigationId: string;
    decision: "approve" | "reject";
    reviewer: string;
    note: string;
  }): Promise<unknown>;
  composeDashboard(input: Record<string, unknown>): Promise<unknown>;
  dashboardPreference(userId: string): Promise<unknown>;
  saveDashboardPreference(
    userId: string,
    composition: unknown,
  ): Promise<unknown>;
};

export function createApplicationServer(api: ApplicationApi): McpServer {
  const server = new McpServer({
    name: "ondaluz-application",
    version: "1.0.0",
  });

  registerAboutResource(
    server,
    "application",
    "Jornadas REST da aplicação, incluindo dashboard, N1, NOC, topologia e revisão humana.",
    [
      "dashboard_get_overview",
      "application_get_health",
      "dashboard_compose",
      "network_get_topology",
      "network_search_topology",
      "network_list_topology_devices",
      "network_list_detected_groupings",
      "network_get_detected_grouping",
      "customers_get_support",
      "customers_list_filter_options",
      "customers_n1_chat",
      "tickets_list_noc_queue",
      "tickets_get_triage",
      "tickets_get_triage_config",
      "tickets_retry_triage",
      "tickets_create",
      "tickets_update_noc_status",
      "incidents_list_active",
      "incidents_list_options",
      "incidents_create",
      "incidents_close",
      "detected_groupings_close",
      "investigations_list",
      "investigations_get_config",
      "investigations_trigger",
      "investigations_retry",
      "investigations_review",
      "dashboard_get_preference",
      "dashboard_save_preference",
    ],
  );

  server.registerTool(
    "application_get_health",
    {
      description: "Retorna a prontidão da API e o estado da carga do dataset.",
      inputSchema: z.object({}),
      annotations: readOnlyAnnotations,
    },
    async () => mcpJson(await api.health()),
  );

  server.registerResource(
    "customer-support",
    new ResourceTemplate(
      "ondaluz://application/customers/{customerId}/support",
      { list: undefined },
    ),
    {
      title: "Contexto de suporte do cliente",
      description:
        "Diagnóstico explicável e orientação atual do atendimento N1.",
      mimeType: "application/json",
    },
    async (uri, { customerId }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            await api.customerSupport(String(customerId)),
            null,
            2,
          ),
        },
      ],
    }),
  );
  server.registerResource(
    "detected-grouping",
    new ResourceTemplate("ondaluz://application/groupings/{id}", {
      list: undefined,
    }),
    {
      title: "Agrupamento detectado",
      description:
        "Evidências, alcance e recomendação de um agrupamento analítico.",
      mimeType: "application/json",
    },
    async (uri, { id }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(await api.detectedGrouping(String(id)), null, 2),
        },
      ],
    }),
  );

  server.registerTool(
    "dashboard_get_overview",
    {
      description:
        "Retorna KPIs, série semanal e leitura executiva do dashboard.",
      inputSchema: z.object({}),
      annotations: readOnlyAnnotations,
    },
    async () => mcpJson(await api.overview()),
  );
  server.registerTool(
    "dashboard_compose",
    {
      description:
        "Compõe um plano de dashboard validado a partir do objetivo do usuário.",
      inputSchema: z.object({
        objective: z.string().min(8).max(600),
        currentPlan: z.record(z.string(), z.unknown()).optional(),
        targetWidgetId: z.string().max(80).optional(),
      }),
      annotations: readOnlyAnnotations,
    },
    async (input) => mcpJson(await api.composeDashboard(input)),
  );
  server.registerTool(
    "network_get_topology",
    {
      description: "Retorna o resumo hierárquico OLT, PON e CTO.",
      inputSchema: z.object({
        olt: z.string().max(40).optional(),
        pon: z.string().max(40).optional(),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ olt, pon }) => mcpJson(await api.topology(olt, pon)),
  );
  server.registerTool(
    "network_search_topology",
    {
      description: "Pesquisa caminhos de cliente ou serial na topologia.",
      inputSchema: z.object({
        query: z.string().min(2).max(120),
        ...pageInput,
      }),
      annotations: readOnlyAnnotations,
    },
    async (input) => mcpJson(await api.topologyPath(input)),
  );
  server.registerTool(
    "network_list_topology_devices",
    {
      description: "Lista os dispositivos de uma CTO de forma paginada.",
      inputSchema: z.object({
        olt: z.string().min(1).max(40),
        pon: z.string().min(1).max(40),
        cto: z.string().min(1).max(80),
        ...pageInput,
      }),
      annotations: readOnlyAnnotations,
    },
    async (input) => mcpJson(await api.topologyDevices(input)),
  );
  server.registerTool(
    "network_list_detected_groupings",
    {
      description: "Lista agrupamentos detectados pelas regras analíticas.",
      inputSchema: z.object({ ...pageInput }),
      annotations: readOnlyAnnotations,
    },
    async (input) => mcpJson(await api.detectedGroupings(input)),
  );
  server.registerTool(
    "network_get_detected_grouping",
    {
      description: "Consulta um agrupamento detectado pelo identificador.",
      inputSchema: z.object({ id: z.string().min(1).max(120) }),
      annotations: readOnlyAnnotations,
    },
    async ({ id }) => mcpJson(await api.detectedGrouping(id)),
  );
  server.registerTool(
    "customers_get_support",
    {
      description:
        "Retorna o diagnóstico explicável usado pelo atendimento N1.",
      inputSchema: z.object({ customerId: z.string().min(1).max(80) }),
      annotations: readOnlyAnnotations,
    },
    async ({ customerId }) => mcpJson(await api.customerSupport(customerId)),
  );
  server.registerTool(
    "customers_list_filter_options",
    {
      description:
        "Lista opções paginadas para os filtros facetados de cliente, CPE, fabricante, modelo, firmware, plano e topologia.",
      inputSchema: z.object({
        query: z.string().max(80).default(""),
        status: z.enum(["active", "removed", "all"]).default("active"),
        ...pageInput,
      }),
      annotations: readOnlyAnnotations,
    },
    async (input) => mcpJson(await api.customerFilterOptions(input)),
  );
  server.registerTool(
    "customers_n1_chat",
    {
      description: "Gera uma orientação contextual para a conversa do N1.",
      inputSchema: z.object({
        customerId: z.string().min(1).max(80),
        message: z.string().min(1).max(1200),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().max(1200),
            }),
          )
          .max(8)
          .default([]),
      }),
      annotations: readOnlyAnnotations,
    },
    async (input) => mcpJson(await api.n1Chat(input)),
  );
  server.registerTool(
    "tickets_list_noc_queue",
    {
      description: "Lista chamados individuais na fila N1 para NOC.",
      inputSchema: z.object({ ...pageInput }),
      annotations: readOnlyAnnotations,
    },
    async (input) => mcpJson(await api.nocQueue(input)),
  );
  server.registerTool(
    "tickets_get_triage",
    {
      description:
        "Retorna o histórico da triagem automática de um ticket N1, incluindo categoria sugerida, escopo individual ou compartilhado, confiança e ações aplicadas.",
      inputSchema: z.object({ ticketId: z.string().min(1).max(120) }),
      annotations: readOnlyAnnotations,
    },
    async ({ ticketId }) => mcpJson(await api.ticketTriage(ticketId)),
  );
  server.registerTool(
    "tickets_get_triage_config",
    {
      description:
        "Retorna a configuração não secreta da triagem automática e separa ações automáticas das que exigem revisão humana.",
      inputSchema: z.object({}),
      annotations: readOnlyAnnotations,
    },
    async () => mcpJson(await api.ticketTriageConfig()),
  );
  server.registerTool(
    "tickets_retry_triage",
    {
      description:
        "Solicita uma nova análise de um ticket, preservando o histórico das triagens anteriores.",
      inputSchema: z.object({ ticketId: z.string().min(1).max(120) }),
      annotations: writeAnnotations,
    },
    async ({ ticketId }) => mcpJson(await api.retryTicketTriage(ticketId)),
  );
  server.registerTool(
    "tickets_create",
    {
      description: "Registra um chamado validado do atendimento N1.",
      inputSchema: z.object({
        customerId: z.string().min(1).max(80),
        openedBy: z.string().min(2).max(100),
        category: z.enum(["Lentidão", "Sem conexão", "Wi-Fi"]),
        description: z.string().min(10).max(600),
        outcome: z.enum(["resolver_telefone", "escalar_noc", "agendar_visita"]),
        relatedProblemId: z.string().max(120).nullable().default(null),
        sourcePayload: z.record(z.string(), z.unknown()).optional(),
      }),
      annotations: writeAnnotations,
    },
    async (input) => mcpJson(await api.createTicket(input)),
  );
  server.registerTool(
    "tickets_update_noc_status",
    {
      description: "Move um chamado na fila operacional do NOC.",
      inputSchema: z.object({
        ticketId: z.string().min(1).max(120),
        status: z.enum(["in_progress", "closed"]),
      }),
      annotations: writeAnnotations,
    },
    async ({ ticketId, status }) =>
      mcpJson(await api.updateTicketStatus(ticketId, status)),
  );
  server.registerTool(
    "incidents_list_active",
    {
      description: "Lista agrupamentos operacionais confirmados e ativos.",
      inputSchema: z.object({
        scopeType: z.string().max(40).default(""),
        ...pageInput,
      }),
      annotations: readOnlyAnnotations,
    },
    async (input) => mcpJson(await api.activeIncidents(input)),
  );
  server.registerTool(
    "incidents_list_options",
    {
      description:
        "Lista opções válidas de escopo para criação de agrupamentos.",
      inputSchema: z.object({
        type: z.enum([
          "olt",
          "pon",
          "cto",
          "customer",
          "firmware",
          "equipment",
          "region",
        ]),
        query: z.string().max(120).default(""),
        olt: z.string().max(40).default(""),
        pon: z.string().max(40).default(""),
        ...pageInput,
      }),
      annotations: readOnlyAnnotations,
    },
    async (input) => mcpJson(await api.incidentOptions(input)),
  );
  server.registerTool(
    "incidents_create",
    {
      description:
        "Cria um agrupamento operacional com autoria humana explícita.",
      inputSchema: z.object({
        openedBy: z.string().min(2).max(100),
        title: z.string().min(5).max(160),
        severity: z.enum(["critical", "high", "medium", "low"]),
        scopeType: z.enum([
          "park",
          "olt",
          "pon",
          "cto",
          "customer",
          "firmware",
          "equipment",
          "region",
        ]),
        identifier: z.string().max(200).default(""),
        olt: z.string().max(40).default(""),
        pon: z.string().max(40).default(""),
        cto: z.string().max(80).default(""),
        probableCause: z.string().min(5).max(600),
        recommendedAction: z.string().min(5).max(600),
        originTicketId: z.string().max(120).nullable().default(null),
      }),
      annotations: writeAnnotations,
    },
    async (input) => mcpJson(await api.createIncident(input)),
  );
  server.registerTool(
    "incidents_close",
    {
      description: "Encerra um agrupamento operacional confirmado.",
      inputSchema: z.object({ incidentId: z.string().min(1).max(120) }),
      annotations: closeAnnotations,
    },
    async ({ incidentId }) => mcpJson(await api.closeIncident(incidentId)),
  );
  server.registerTool(
    "detected_groupings_close",
    {
      description: "Encerra um agrupamento produzido pelas regras analíticas.",
      inputSchema: z.object({ groupingId: z.string().min(1).max(120) }),
      annotations: closeAnnotations,
    },
    async ({ groupingId }) =>
      mcpJson(await api.closeDetectedGrouping(groupingId)),
  );
  server.registerTool(
    "investigations_list",
    {
      description: "Lista investigações e o estado da revisão humana.",
      inputSchema: z.object({
        status: z.string().max(40).default(""),
        ...pageInput,
      }),
      annotations: readOnlyAnnotations,
    },
    async (input) => mcpJson(await api.investigations(input)),
  );
  server.registerTool(
    "investigations_get_config",
    {
      description: "Retorna a configuração pública do agente de investigação.",
      inputSchema: z.object({}),
      annotations: readOnlyAnnotations,
    },
    async () => mcpJson(api.investigationConfig()),
  );
  server.registerTool(
    "investigations_trigger",
    {
      description:
        "Dispara uma investigação por agrupamentos, agenda ou objetivo manual.",
      inputSchema: z.object({
        kind: z.enum(["groupings", "scheduled", "manual"]),
        objective: z.string().max(600).optional(),
      }),
      annotations: writeAnnotations,
    },
    async ({ kind, objective }) =>
      mcpJson(await api.triggerInvestigations(kind, objective)),
  );
  server.registerTool(
    "investigations_retry",
    {
      description:
        "Reenfileira uma investigação que falhou ou ficou inconclusiva.",
      inputSchema: z.object({ investigationId: z.string().min(1).max(120) }),
      annotations: writeAnnotations,
    },
    async ({ investigationId }) =>
      mcpJson(await api.retryInvestigation(investigationId)),
  );
  server.registerTool(
    "investigations_review",
    {
      description:
        "Registra a decisão humana sobre uma proposta de investigação.",
      inputSchema: z.object({
        investigationId: z.string().min(1).max(120),
        decision: z.enum(["approve", "reject"]),
        reviewer: z.string().min(2).max(100),
        note: z.string().max(600).default(""),
      }),
      annotations: writeAnnotations,
    },
    async (input) => mcpJson(await api.reviewInvestigation(input)),
  );
  server.registerTool(
    "dashboard_get_preference",
    {
      description:
        "Recupera a composição de dashboard persistida para um usuário local.",
      inputSchema: z.object({
        userId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ userId }) => mcpJson(await api.dashboardPreference(userId)),
  );
  server.registerTool(
    "dashboard_save_preference",
    {
      description:
        "Valida e persiste uma composição completa de dashboard para um usuário local.",
      inputSchema: z.object({
        userId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/),
        composition: z.record(z.string(), z.unknown()),
      }),
      annotations: writeAnnotations,
    },
    async ({ userId, composition }) =>
      mcpJson(await api.saveDashboardPreference(userId, composition)),
  );

  return server;
}
