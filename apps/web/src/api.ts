import type {
  EquipmentPath,
  DiagnosticsPage,
  InventoryPage,
  Overview,
  InvestigationPage,
  IncidentOptions,
  IncidentOptionType,
  NocQueue,
  OperationalIncidentPage,
  SupportProfile,
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
  method: "POST" | "PATCH" | "DELETE",
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
  overview: () => request<Overview>("/api/network/overview"),
  inventory: (
    query = "",
    page = 1,
    status: "active" | "removed" | "all" = "active",
  ) => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "25",
      status,
    });
    if (query.trim()) params.set("q", query.trim());
    return request<InventoryPage>(`/api/customers?${params.toString()}`);
  },
  support: (customerId: string) =>
    request<SupportProfile>(
      `/api/customers/${encodeURIComponent(customerId)}/support`,
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
    request<EquipmentPath[]>(
      `/api/network/topology/path?q=${encodeURIComponent(query)}`,
    ),
  topologyDevices: (olt: string, pon: string, cto: string) => {
    const query = new URLSearchParams({ olt, pon, cto });
    return request<EquipmentPath[]>(
      `/api/network/topology/devices?${query.toString()}`,
    );
  },
  tickets: (
    query = "",
    page = 1,
    filters: { category: string; resolution: string; channel: string },
  ) => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "25",
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
  nocQueue: () => request<NocQueue>("/api/tickets/noc-queue"),
  updateNocTicketStatus: (ticketId: string, status: "in_progress" | "closed") =>
    mutate<{ ticket_id: string; noc_status: "in_progress" | "closed" }>(
      `/api/tickets/${encodeURIComponent(ticketId)}/noc-status`,
      "PATCH",
      { status },
    ),
  operationalIncidents: () =>
    request<OperationalIncidentPage>("/api/incidents"),
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
      limit: "40",
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
      limit: "25",
      state: filters.state,
      requestedBy: filters.requestedBy,
    });
    if (query.trim()) params.set("q", query.trim());
    return request<DiagnosticsPage>(`/api/diagnostics?${params.toString()}`);
  },
  investigations: () => request<InvestigationPage>("/api/investigations"),
  triggerMetricInvestigations: () =>
    mutate<Record<string, unknown>>(
      "/api/investigations/trigger/metrics",
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
