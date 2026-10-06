export type Incident = {
  id: string;
  severity: "critical" | "high" | "medium";
  scope: "firmware" | "network" | "equipment" | "customer";
  title: string;
  location: string;
  affected: number;
  score: number;
  confidence: "Alta" | "Média";
  signal: string;
  evidence: string[];
  recommendation: string;
  owner: string;
  cost: number;
  costLabel: string;
};

export type Overview = {
  asOf: string;
  kpis: {
    activeCpes: number;
    ticketGrowthPct: number;
    affectedCpes: number;
    repeatCustomers: number;
    estimatedImpact: number;
  };
  weeklyTickets: Array<{
    week: string;
    total: number;
    slowness: number;
    disconnected: number;
    wifi: number;
  }>;
  incidents: Incident[];
  readout: { headline: string; summary: string };
};

export type SupportProfile = {
  customer: { id: string; city: string; neighborhood: string };
  equipment: {
    serial: string;
    vendor: string;
    model: string;
    hardware: string;
    firmware: string;
    planMbps: number;
    previousPlanMbps: number | null;
    planSince: string;
    network: string;
  };
  metrics: {
    mem_min_pct: number | null;
    reboot_count: number;
    lan_min_mbps: number | null;
    optical_rx_min_dbm: number | null;
    optical_low_days: number;
    wifi_signal_raw: number | null;
    last_day: string;
    diagnostic: null | {
      ts: string;
      state: string;
      download_mbps: number | null;
      upload_mbps: number | null;
      ratio: number | null;
    };
  };
  decision: {
    issue: string;
    confidence: string;
    action: "escalar_noc" | "agendar_visita" | "resolver_telefone";
    actionLabel: string;
    sayToCustomer: string;
    operatorSteps: string[];
    reasons: string[];
    relatedProblemId: string | null;
    relatedProblemTitle: string | null;
    relatedProblemKind: "incident" | "signal" | null;
  };
  recentTickets: Array<{
    ticket_id: string;
    opened_at: string;
    category: string;
    description: string;
    resolution: string;
  }>;
};

export type TopologySnapshot = {
  totals: { cpes: number; olts: number; pons: number; ctos: number };
  olts: Array<{
    olt: string;
    cpes: number;
    pons: number;
    ctos: number;
    cities: string[];
    neighborhoods: string[];
  }>;
  pons: Array<{ pon: string; cpes: number; ctos: number }>;
  ctos: Array<{
    cto: string;
    cpes: number;
    city: string;
    neighborhood: string;
  }>;
  selected: { olt: string | null; pon: string | null };
  limitations: {
    hasCableIds: boolean;
    hasDropIds: boolean;
    hasLogicalDropIds: boolean;
    message: string;
  };
};

export type EquipmentPath = {
  serial: string;
  customer_id: string;
  vendor: string;
  model: string;
  hw_revision: string;
  software_version: string;
  plan_mbps: number;
  olt: string;
  pon: string;
  cto: string;
  city: string;
  neighborhood: string;
  logical_drop_id: string | null;
};

export type InventoryRecord = {
  serial: string;
  customer_id: string;
  vendor: string;
  model: string;
  hw_revision: string;
  software_version: string;
  plan_mbps: number;
  previous_plan_mbps: number | null;
  plan_since: string;
  olt: string;
  pon_port: string;
  cto: string;
  city: string;
  neighborhood: string;
  status: "active" | "removed";
  installed_at: string;
  removed_at: string | null;
};

export type InventoryPage = {
  page: number;
  limit: number;
  total: number;
  items: InventoryRecord[];
};

export type SupportTicket = {
  ticket_id: string;
  opened_at: string;
  customer_id: string;
  channel: string;
  category: string;
  description: string;
  resolution: string;
  closed_at: string | null;
  handling_minutes: number | null;
  source: "dataset" | "n1";
  opened_by: string | null;
  related_problem_id: string | null;
  noc_status:
    "not_applicable" | "pending" | "in_progress" | "linked" | "closed";
  city: string | null;
  neighborhood: string | null;
  olt: string | null;
  pon: string | null;
  cto: string | null;
};

export type NocQueue = {
  total: number;
  summary: { received: number; inProgress: number };
  items: SupportTicket[];
};

export type OperationalIncident = {
  incident_id: string;
  investigation_id: string | null;
  status: "open" | "mitigating" | "monitoring" | "resolved";
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  scope: {
    type: string;
    identifier: string;
    olt?: string | null;
    pon?: string | null;
    cto?: string | null;
  };
  affected_cpes: number;
  confidence: number;
  probable_cause: string;
  recommended_action: string;
  evidence: Array<Record<string, unknown>>;
  opened_at: string;
  opened_by: string;
  approval_note: string | null;
  source: "agent" | "manual";
  origin_ticket_id: string | null;
};

export type OperationalIncidentPage = {
  total: number;
  items: OperationalIncident[];
};

export type IncidentOptionType =
  "olt" | "pon" | "cto" | "customer" | "firmware" | "equipment" | "region";

export type IncidentOptions = {
  type: IncidentOptionType;
  items: Array<{ value: string; label: string }>;
};

export type TicketPage = {
  page: number;
  limit: number;
  total: number;
  summary: {
    total: number;
    technical: number;
    escalated: number;
    visits: number;
    avg_handling_minutes: number | null;
  };
  items: SupportTicket[];
  filters: {
    categories: string[];
    resolutions: string[];
    channels: string[];
  };
};

export type DiagnosticRecord = {
  ts: string;
  serial: string;
  requested_by: string;
  diagnostic: string;
  state: string;
  download_mbps: number | null;
  upload_mbps: number | null;
  test_server: string | null;
  customer_id: string | null;
  vendor: string | null;
  model: string | null;
  plan_mbps: number | null;
  city: string | null;
  neighborhood: string | null;
  olt: string | null;
  pon: string | null;
  cto: string | null;
};

export type DiagnosticsPage = {
  page: number;
  limit: number;
  total: number;
  summary: {
    total: number;
    completed: number;
    errors: number;
    avg_download_mbps: number | null;
    avg_upload_mbps: number | null;
  };
  items: DiagnosticRecord[];
  filters: { states: string[]; requested_by: string[] };
};

export type InvestigationFinding = {
  analysisVersion: "1.0";
  problemDetected: boolean;
  category: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
  scope: {
    type: "park" | "network" | "firmware" | "equipment" | "customer";
    identifier: string;
    olt: string | null;
    pon: string | null;
  };
  affectedCpes: number;
  summary: string;
  probableCause: string;
  recommendedAction: string;
  evidence: Array<{ source: string; reference: string; summary: string }>;
  counterEvidence: Array<{
    source: string;
    reference: string;
    summary: string;
  }>;
  requiresHumanReview: true;
};

export type Investigation = {
  investigation_id: string;
  trigger_type: "metric" | "schedule" | "manual";
  trigger_label: string;
  objective: string;
  scope: Record<string, unknown>;
  status:
    | "queued"
    | "running"
    | "no_problem"
    | "inconclusive"
    | "pending_review"
    | "approved"
    | "rejected"
    | "failed";
  model: string | null;
  finding: InvestigationFinding | null;
  tool_trace: Array<{
    domain: string;
    tool: string;
    arguments: Record<string, unknown>;
    outputPreview: string;
  }>;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  incident_id: string | null;
};

export type InvestigationPage = {
  config: {
    openaiConfigured: boolean;
    model: string;
    mcpBaseUrl: string;
    scheduleEnabled: boolean;
    metricTriggerEnabled: boolean;
    metricTriggerIntervalMs: number;
    maxConcurrency: number;
    reasoningEffort: "none" | "low";
    maxContextCharacters: number;
    toolCallBudgets: {
      metric: number;
      schedule: number;
      manual: number;
    };
    humanApprovalRequired: boolean;
    writeToolsAvailableToAgent: boolean;
  };
  summary: Record<string, number>;
  investigations: Investigation[];
  incidents: Array<Record<string, unknown>>;
};
