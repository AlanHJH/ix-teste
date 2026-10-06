import type {
  EquipmentPath,
  DashboardComposition,
  DailyMetricPage,
  DiagnosticsPage,
  InventoryPage,
  InventoryFilter,
  InventoryFilterOption,
  Overview,
  InvestigationPage,
  IncidentOptions,
  IncidentOptionType,
  NocQueue,
  OperationalIncidentPage,
  SupportProfile,
  N1AdvisorReply,
  N1ChatMessage,
  TicketPage,
  TopologySnapshot,
} from "./types";

async function request<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? `Falha ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function mutate<T>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = Array.isArray(payload?.message)
      ? payload.message.join(" ")
      : payload?.message;
    throw new Error(message ?? `Falha ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  dashboardPreference: (userId: string) =>
    request<{
      composition: DashboardComposition | null;
      updatedAt: string | null;
    }>(`/api/dashboard/preferences/${encodeURIComponent(userId)}`),
  saveDashboardPreference: (
    userId: string,
    composition: DashboardComposition,
  ) =>
    mutate<{
      composition: DashboardComposition;
      updatedAt: string;
    }>(`/api/dashboard/preferences/${encodeURIComponent(userId)}`, "PUT", {
      composition,
    }),
  composeDashboard: (
    objective: string,
    currentPlan?: DashboardComposition,
    targetWidgetId?: string,
  ) =>
    mutate<DashboardComposition>("/api/dashboard/compose", "POST", {
      objective,
      ...(currentPlan ? { currentPlan } : {}),
      ...(targetWidgetId ? { targetWidgetId } : {}),
    }),
  overview: () => request<Overview>("/api/network/overview"),
  dashboardInventory: (query = "") => {
    const params = new URLSearchParams({
      q: query,
      status: "active",
      page: "1",
      pageSize: "15",
      sort: "customer_id_asc",
    });
    return request<InventoryPage>(`/api/inventory?${params}`);
  },
  dashboardTelemetry: (fromDay = "") => {
    const params = new URLSearchParams({
      page: "1",
      pageSize: "15",
      sort: "day_desc",
    });
    if (fromDay) params.set("fromDay", fromDay);
    return request<DailyMetricPage>(`/api/telemetry/daily-metrics?${params}`);
  },
  dashboardDiagnostics: (from = "") => {
    const params = new URLSearchParams({
      page: "1",
      pageSize: "15",
      sort: "ts_desc",
    });
    if (from) params.set("from", from);
    return request<DiagnosticsPage>(`/api/diagnostics?${params}`);
  },
  inventory: (
    query = "",
    page = 1,
    status: "active" | "removed" | "all" = "active",
    filters: InventoryFilter[] = [],
  ) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "25",
      sort: "relevance",
      status,
    });
    if (query.trim()) params.set("q", query.trim());
    filters.forEach((filter) =>
      params.append("filter", `${filter.kind}:${filter.value}`),
    );
    return request<InventoryPage>(`/api/customers?${params.toString()}`);
  },
  inventoryFilterOptions: (
    query = "",
    status: "active" | "removed" | "all" = "active",
  ) => {
    const params = new URLSearchParams({ q: query.trim(), status });
    return request<{ data: InventoryFilterOption[] }>(
      `/api/customers/filter-options?${params.toString()}`,
    ).then((response) => response.data);
  },
  support: (customerId: string) =>
    request<SupportProfile>(
      `/api/customers/${encodeURIComponent(customerId)}/support`,
    ),
  n1Chat: (customerId: string, message: string, history: N1ChatMessage[]) =>
    mutate<N1AdvisorReply>(
      `/api/customers/${encodeURIComponent(customerId)}/n1-chat`,
      "POST",
      { message, history },
    ),
  topology: (olt?: string, pon?: string) => {
    const params = new URLSearchParams();
    if (olt) params.set("olt", olt);
    if (pon) params.set("pon", pon);
    const query = params.toString();
    return request<TopologySnapshot>(
      `/api/network/topology${query ? `?${query}` : ""}`,
    );
  },
  topologyPath: (query: string) =>
    request<{
      data: EquipmentPath[];
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    }>(
      `/api/network/topology/path?q=${encodeURIComponent(query)}&page=1&pageSize=8&sort=relevance`,
    ).then((response) => response.data),
  topologyDevices: (olt: string, pon: string, cto: string) => {
    const query = new URLSearchParams({
      olt,
      pon,
      cto,
      page: "1",
      pageSize: "100",
      sort: "customer_id_asc",
    });
    return request<{
      data: EquipmentPath[];
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    }>(`/api/network/topology/devices?${query.toString()}`).then(
      (response) => response.data,
    );
  },
  tickets: (
    query = "",
    page = 1,
    filters: { category: string; resolution: string; channel: string },
  ) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "25",
      sort: "opened_at_desc",
      category: filters.category,
      resolution: filters.resolution,
      channel: filters.channel,
    });
    if (query.trim()) params.set("q", query.trim());
    return request<TicketPage>(`/api/tickets?${params.toString()}`);
  },
  createTicket: (input: {
    customerId: string;
    openedBy: string;
    category: string;
    description: string;
    outcome: "resolver_telefone" | "escalar_noc" | "agendar_visita";
    relatedProblemId: string | null;
  }) =>
    mutate<{ ticket_id: string; resolution: string }>(
      "/api/tickets",
      "POST",
      input,
    ),
  nocQueue: () =>
    request<NocQueue>(
      "/api/tickets/noc-queue?page=1&pageSize=100&sort=opened_at_asc",
    ),
  updateNocTicketStatus: (ticketId: string, status: "in_progress" | "closed") =>
    mutate<{ ticket_id: string; noc_status: "in_progress" | "closed" }>(
      `/api/tickets/${encodeURIComponent(ticketId)}/noc-status`,
      "PATCH",
      { status },
    ),
  operationalIncidents: () =>
    request<OperationalIncidentPage>(
      "/api/incidents?page=1&pageSize=100&sort=severity_desc",
    ),
  incidentOptions: (input: {
    type: IncidentOptionType;
    query?: string;
    olt?: string;
    pon?: string;
  }) => {
    const params = new URLSearchParams({
      type: input.type,
      q: input.query ?? "",
      olt: input.olt ?? "",
      pon: input.pon ?? "",
      page: "1",
      pageSize: "40",
      sort: "value_asc",
    });
    return request<IncidentOptions>(`/api/incidents/options?${params}`);
  },
  createOperationalIncident: (input: {
    openedBy: string;
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    scopeType:
      | "park"
      | "olt"
      | "pon"
      | "cto"
      | "customer"
      | "firmware"
      | "equipment"
      | "region";
    identifier: string;
    olt: string;
    pon: string;
    cto: string;
    probableCause: string;
    recommendedAction: string;
    originTicketId: string | null;
  }) => mutate<{ incident_id: string }>("/api/incidents", "POST", input),
  closeOperationalIncident: (incidentId: string) =>
    mutate<{ incident_id: string; status: "resolved" }>(
      `/api/incidents/${encodeURIComponent(incidentId)}/status`,
      "PATCH",
      { status: "resolved" },
    ),
  closeDetectedGrouping: (groupingId: string) =>
    mutate<{ grouping_id: string; status: "resolved" }>(
      `/api/network/incidents/${encodeURIComponent(groupingId)}/status`,
      "PATCH",
      { status: "resolved" },
    ),
  diagnostics: (
    query = "",
    page = 1,
    filters: { state: string; requestedBy: string },
  ) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "25",
      sort: "ts_desc",
      state: filters.state,
      requestedBy: filters.requestedBy,
    });
    if (query.trim()) params.set("q", query.trim());
    return request<DiagnosticsPage>(`/api/diagnostics?${params.toString()}`);
  },
  investigations: () =>
    request<InvestigationPage>(
      "/api/investigations?page=1&pageSize=100&sort=created_at_desc",
    ),
  triggerMetricInvestigations: () =>
    mutate<Record<string, unknown>>(
      "/api/investigations/trigger/metrics",
      "POST",
    ),
  triggerGroupingInvestigations: () =>
    mutate<Record<string, unknown>>(
      "/api/investigations/trigger/groupings",
      "POST",
    ),
  triggerScheduledInvestigation: () =>
    mutate<Record<string, unknown>>(
      "/api/investigations/trigger/scheduled",
      "POST",
    ),
  triggerManualInvestigation: (objective: string) =>
    mutate<Record<string, unknown>>(
      "/api/investigations/trigger/manual",
      "POST",
      { objective },
    ),
  retryInvestigation: (investigationId: string) =>
    mutate<Record<string, unknown>>(
      `/api/investigations/${encodeURIComponent(investigationId)}/retry`,
      "POST",
    ),
  reviewInvestigation: (
    investigationId: string,
    decision: "approve" | "reject",
    reviewer: string,
    note: string,
  ) =>
    mutate<Record<string, unknown>>(
      `/api/investigations/${encodeURIComponent(investigationId)}/review`,
      "PATCH",
      { decision, reviewer, note },
    ),
};
