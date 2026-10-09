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
    oltCount: number;
    ponCount: number;
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

export type DashboardBinding =
  | "overview.activeCpes"
  | "overview.oltCount"
  | "overview.ponCount"
  | "overview.affectedCpes"
  | "overview.repeatCustomers"
  | "overview.ticketGrowthPct"
  | "overview.estimatedImpact"
  | "overview.weeklyTickets"
  | "overview.detectedIncidents"
  | "overview.executiveReadout"
  | "overview.ticketMix"
  | "network.topology"
  | "inventory.customers"
  | "inventory.equipment"
  | "telemetry.dailyMetrics"
  | "diagnostics.list"
  | "operations.activeIncidents"
  | "operations.nocQueue";

export type DashboardWidget = {
  id: string;
  kind:
    | "metric"
    | "timeseries"
    | "bar"
    | "pie"
    | "multiseries"
    | "alerts"
    | "queue"
    | "narrative"
    | "table"
    | "topology"
    | "map";
  size: "compact" | "half" | "wide";
  columns: number;
  title: string;
  description: string;
  binding: DashboardBinding;
  tone: "neutral" | "positive" | "warning" | "critical";
  config?: {
    limit: 5 | 10 | 15;
    formula: null | {
      operation: "sum" | "average" | "difference" | "ratio" | "percentage";
      operands: DashboardBinding[];
      decimals: 0 | 1 | 2;
      suffix: string;
    };
  };
};

export type DashboardComposition = {
  version: "1.0";
  title: string;
  subtitle: string;
  refreshSeconds: number;
  widgets: DashboardWidget[];
  objective: string;
  generatedAt: string;
  generatedBy: "openai" | "fallback";
  model: string | null;
  discovery: {
    protocol: "MCP";
    mode: "openapi-bridge";
    resourceCount: number;
    endpoint: "/mcp/openapi";
    document: "/api/openapi.json";
  };
  runtimeData: {
    protocol: "REST";
    endpoints: string[];
  };
};

export type DashboardSummary = {
  dashboardId: string;
  userId: string;
  name: string;
  description: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DashboardDetail = DashboardSummary & {
  composition: DashboardComposition;
};

export type DashboardLibrary = {
  data: DashboardSummary[];
  defaultDashboardId: string | null;
};

export type OfflineAlert = {
  customer_id: string;
  serial: string;
  vendor: string;
  model: string;
  city: string;
  neighborhood: string;
  network: string;
  ticket_id: string;
  reported_at: string;
  description: string;
  resolution: string;
  alert_status: "in_noc" | "open" | "recent";
  confirmed_offline: false;
};

export type OfflineAlertPage = {
  data: OfflineAlert[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type CustomerSummary = {
  customer_id: string;
  customer_status: "active" | "cancelled" | string;
  customer_since: string;
  cancelled_at: string | null;
  active_serial: string | null;
  city: string;
  neighborhood: string;
  plan_mbps: number;
};

export type CustomerSummaryPage = {
  data: CustomerSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type CustomerDetailEquipment = {
  serial: string;
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
  installed_at: string;
  status: "active" | "removed";
  removed_at: string | null;
};

export type CustomerDetail = {
  customer: {
    customer_id: string;
    customer_status: "active" | "cancelled" | string;
    customer_since: string;
    cancelled_at: string | null;
  };
  equipment_history: CustomerDetailEquipment[];
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
  preflight: {
    infrastructureChecked: boolean;
    measurementsChecked: boolean;
    nocHistoryChecked: boolean;
    relatedHistoryFound: boolean;
    measurementStatus: "related_history" | "new_signal" | "no_signal";
    mainAdvice: string;
    escalation: {
      required: boolean;
      target: "NOC" | null;
      reason: string;
    };
  };
  problemHistory: Array<{
    incidentId: string;
    title: string;
    status: "open" | "mitigating" | "monitoring" | "resolved";
    severity: "critical" | "high" | "medium" | "low";
    category: string;
    scope: {
      type?: string;
      identifier?: string;
      olt?: string | null;
      pon?: string | null;
      cto?: string | null;
    };
    affectedCpes: number;
    confidence: number;
    probableCause: string;
    recommendedAction: string;
    openedAt: string;
    openedBy: string;
    source: "agent" | "manual";
    originTicketId: string | null;
  }>;
  activeIncidents: Array<{
    incidentId: string;
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    category: string;
    scope: {
      type?: string;
      identifier?: string;
      olt?: string | null;
      pon?: string | null;
      cto?: string | null;
    };
    affectedCpes: number;
    confidence: number;
    probableCause: string;
    recommendedAction: string;
    openedAt: string;
    openedBy: string;
    source: "agent" | "manual";
    originTicketId: string | null;
  }>;
  recentTickets: Array<{
    ticket_id: string;
    opened_at: string;
    category: string;
    description: string;
    resolution: string;
  }>;
  allTickets: Array<{
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

export type N1ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type IrisChatMessage = N1ChatMessage;

export type IrisContext = {
  view?: string;
  entity?: string;
  selection?: string;
  ticketId?: string;
  problemId?: string;
  customerId?: string;
  serial?: string;
  technicalTerm?: string;
  technicalDescription?: string;
};

export type IrisEvidence = {
  label: string;
  detail: string;
};

export type IrisSource = {
  domain: string;
  tool: string;
};

export type IrisVisualization = {
  kind: "kpi" | "bar" | "line" | "table";
  title: string;
  description: string;
  unit: string;
  primaryLabel: string;
  secondaryLabel: string;
  points: Array<{
    label: string;
    value: number;
    secondaryValue: number;
    detail: string;
  }>;
};

export type IrisReply = {
  assistantMessage: string;
  summary: string;
  evidence: IrisEvidence[];
  sources: IrisSource[];
  visualizations: IrisVisualization[];
  suggestedQuestions: string[];
  actionNote: string;
  model: "openai" | "fallback" | "unavailable";
};

export type N1DeepAnalysis = {
  headline: string;
  summary: string;
  causes: Array<{
    title: string;
    likelihood: "alta" | "média" | "baixa";
    evidence: string[];
    counterEvidence: string[];
  }>;
  path: Array<{
    step: number;
    title: string;
    action: string;
    why: string;
    decision: string;
  }>;
  confirmed: string[];
  unknowns: string[];
  customerScript: string;
  escalation: string;
  model: "openai" | "fallback";
};

export type N1AdvisorReply = {
  assistantMessage: string;
  nextSteps: string[];
  options: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  documentation: string;
  disposition: "continue" | "resolve_phone" | "escalate_noc" | "schedule_visit";
  model: "openai" | "fallback";
  deepAnalysis: N1DeepAnalysis;
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
  data: InventoryRecord[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type InventorySort =
  | "customer_id_asc"
  | "customer_id_desc"
  | "serial_asc"
  | "serial_desc"
  | "equipment_asc"
  | "equipment_desc"
  | "firmware_plan_asc"
  | "firmware_plan_desc"
  | "topology_asc"
  | "topology_desc"
  | "status_asc"
  | "status_desc";

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

export type InventoryFilter = {
  kind: InventoryFilterKind;
  value: string;
  label: string;
  detail: string;
};

export type InventoryFilterOption = InventoryFilter & {
  count: number;
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
  source_payload?: Record<string, unknown>;
  noc_status:
    "not_applicable" | "pending" | "in_progress" | "linked" | "closed";
  ai_triage_status:
    "unprocessed" | "running" | "completed" | "needs_review" | "failed";
  ai_triage_run_id: string | null;
  ai_triage_category: string | null;
  ai_triage_confidence: number | null;
  ai_triage_action: string | null;
  ai_triage_reason: string | null;
  ai_triage_review_required: boolean;
  ai_triage_at: string | null;
  city: string | null;
  neighborhood: string | null;
  olt: string | null;
  pon: string | null;
  cto: string | null;
};

export type TicketTriageRun = {
  triage_id: string;
  ticket_id: string;
  status: "running" | "completed" | "needs_review" | "failed";
  observed_category: string;
  suggested_category: string | null;
  category_correct: boolean | null;
  confidence: number | null;
  action: string;
  reason: string;
  case_scope: "individual" | "shared" | "uncertain";
  noc_candidate: boolean;
  noc_reason: string | null;
  evidence: string[];
  input_snapshot: Record<string, unknown>;
  decision: Record<string, unknown> | null;
  model: string | null;
  response_id: string | null;
  action_applied: string;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

export type TicketTriageContextSnapshot = {
  customer?: {
    customerId: string;
    status: string | null;
    customerSince: string | null;
    cancelledAt: string | null;
    equipmentCount: number;
    activeEquipmentCount: number;
    activePlanMbps: number | null;
  };
  equipment?: {
    serial: string;
    vendor: string;
    model: string;
    hardware: string;
    firmware: string;
    planMbps: number;
    olt: string;
    pon: string;
    cto: string;
    city: string;
    neighborhood: string;
    installedAt?: string | null;
    planSince?: string | null;
  } | null;
  recentMetrics?: Array<Record<string, unknown>>;
  recentLogs?: Array<Record<string, unknown>>;
  recentDiagnostics?: Array<Record<string, unknown>>;
  recentCustomerTickets?: Array<Record<string, unknown>>;
  relatedTickets?: Array<{
    ticket_id: string;
    opened_at: string;
    customer_id: string;
    category: string;
    description: string;
    relation: string;
  }>;
  correlation?: {
    windowStart: string;
    windowEnd: string;
    relatedTicketCount: number;
    relatedCustomerCount: number;
    relatedEquipmentCount: number;
    relationCounts: Record<string, number>;
    activeIncidentCount: number;
  };
  activeIncidents?: Array<{
    incident_id: string;
    status: string;
    severity: string;
    title: string;
    affected_cpes: number;
    probable_cause: string;
    recommended_action: string;
    opened_at: string;
    origin_ticket_id: string | null;
  }>;
  timeline?: Array<{
    at: string;
    source: string;
    kind: string;
    reference: string;
    summary: string;
  }>;
  evidenceBundle?: Array<{
    source: string;
    reference: string;
    observedAt: string | null;
    summary: string;
    details: Record<string, unknown>;
  }>;
  dataQuality?: {
    checked: string[];
    missing: string[];
    latestMetricAt: string | null;
    latestLogAt: string | null;
    latestDiagnosticAt: string | null;
  };
};

export type TicketTriageConfig = {
  openaiConfigured: boolean;
  model: string;
  scheduleEnabled: boolean;
  intervalMs: number;
  batchSize: number;
  minConfidence: number;
  autoClose: boolean;
  automaticActions: string[];
  humanReviewActions: string[];
};

export type TicketTriageRetryResult = {
  skipped: boolean;
  requested: boolean;
  reason?: string;
  ticketId: string;
  triageId?: string | null;
  status?: "completed" | "needs_review" | "failed";
  previousRunsPreserved?: boolean;
};

export type TicketFilterKind =
  | "ticket"
  | "customer"
  | "category"
  | "resolution"
  | "channel"
  | "nocStatus"
  | "source"
  | "openedBy"
  | "olt"
  | "pon"
  | "cto";

export type TicketSort =
  | "opened_at_desc"
  | "opened_at_asc"
  | "customer_id_asc"
  | "customer_id_desc"
  | "category_asc"
  | "category_desc"
  | "resolution_asc"
  | "resolution_desc"
  | "handling_minutes_desc"
  | "handling_minutes_asc"
  | "noc_priority_desc";

export type TicketFilter = {
  kind: TicketFilterKind;
  value: string;
  label: string;
  detail: string;
};

export type TicketFilterOption = TicketFilter & { count: number };

export type NocQueue = {
  data: SupportTicket[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  meta: { summary: { received: number; inProgress: number } };
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

export type TopologyFocus = {
  id: string;
  kind: "grouping" | "connection";
  title: string;
  severity: OperationalIncident["severity"];
  confidence: number;
  scope: {
    type: string;
    identifier: string;
    olt?: string | null;
    pon?: string | null;
    cto?: string | null;
  };
  affectedCpes: number;
};

export type OperationalIncidentPage = {
  data: OperationalIncident[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type IncidentOptionType =
  "olt" | "pon" | "cto" | "customer" | "firmware" | "equipment" | "region";

export type IncidentOptions = {
  data: Array<{ value: string; label: string }>;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  meta: { type: IncidentOptionType };
};

export type TicketPage = {
  data: SupportTicket[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  meta: {
    summary: {
      total: number;
      technical: number;
      escalated: number;
      visits: number;
      avg_handling_minutes: number | null;
    };
    filters: {
      categories: string[];
      resolutions: string[];
      channels: string[];
    };
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
  data: DiagnosticRecord[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  meta: {
    summary: {
      total: number;
      completed: number;
      errors: number;
      avg_download_mbps: number | null;
      avg_upload_mbps: number | null;
    };
    filters: { states: string[]; requested_by: string[] };
  };
};

export type DiagnosticFilterKind =
  | "serial"
  | "customer"
  | "vendor"
  | "model"
  | "state"
  | "requestedBy"
  | "diagnostic"
  | "olt"
  | "pon"
  | "cto"
  | "testServer";

export type DiagnosticSort =
  | "ts_desc"
  | "ts_asc"
  | "serial_asc"
  | "serial_desc"
  | "state_asc"
  | "state_desc"
  | "download_mbps_desc"
  | "download_mbps_asc"
  | "olt_asc"
  | "olt_desc"
  | "failures_first";

export type DiagnosticFilter = {
  kind: DiagnosticFilterKind;
  value: string;
  label: string;
  detail: string;
};

export type DiagnosticFilterOption = DiagnosticFilter & { count: number };

export type DailyMetricRecord = {
  day: string;
  serial: string;
  customer_id: string;
  vendor: string;
  model: string;
  software_version: string;
  plan_mbps: number;
  olt: string;
  pon_port: string;
  cto: string;
  city: string;
  neighborhood: string;
  inform_count: number;
  mem_min_pct: number | null;
  reboot_count: number;
  fec_errors: number;
  optical_rx_min_dbm: number | null;
};

export type DailyMetricPage = {
  data: DailyMetricRecord[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type DashboardRuntimeData = {
  overview: Overview;
  activeIncidents: OperationalIncidentPage;
  nocQueue: NocQueue;
  topology: TopologySnapshot;
  inventory: InventoryPage;
  telemetry: DailyMetricPage;
  diagnostics: DiagnosticsPage;
  fetchedAt: string;
};

export type InvestigationFinding = {
  analysisVersion: "1.0";
  problemDetected: boolean;
  category: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
  scope: {
    type:
      | "park"
      | "olt"
      | "pon"
      | "cto"
      | "customer"
      | "firmware"
      | "equipment"
      | "region"
      | "network";
    identifier: string;
    olt: string | null;
    pon: string | null;
    cto: string | null;
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

export type TopologyIssue = {
  investigationId: string;
  title: string;
  severity: InvestigationFinding["severity"];
  confidence: number;
  status: Investigation["status"];
  scope: InvestigationFinding["scope"];
  affectedCpes: number;
  source?: "investigation" | "measurements";
  technicalMessage?: string;
};

export type AgentRuntimeConfiguration = {
  openaiConfigured: boolean;
  model: string;
  mcpBaseUrl: string;
  scheduleEnabled: boolean;
  metricTriggerEnabled: boolean;
  metricTriggerIntervalMs: number;
  maxConcurrency: number;
  groupingMaxCandidates: number;
  autoGroupingEnabled: boolean;
  autoGroupingMinConfidence: number;
  reasoningEffort: "none" | "low";
  openaiTimeoutMs: number;
  maxContextCharacters: number;
  toolCallBudgets: {
    metric: number;
    schedule: number;
    manual: number;
  };
  mcpPolicy: {
    endpointCount: number;
    toolCount: number;
    domains: Array<{ domain: string; tools: string[] }>;
  };
  humanApprovalRequired: boolean;
  writeToolsAvailableToAgent: boolean;
};

export type PlatformCatalog = {
  name: string;
  rest: {
    basePath: string;
    operationCount: number;
    endpoints: string[];
    operations: Array<{
      method: string;
      path: string;
      operationId?: string;
      summary?: string;
      readOnly: boolean;
      dashboardResource: boolean;
    }>;
  };
  documentation: {
    swagger: string;
    openapiJson: string;
    openapiYaml: string;
  };
  mcp: {
    basePath: string;
    transport: string;
    endpoints: Array<{
      path: string;
      domain: string;
      description: string;
    }>;
  };
  health: string;
};

export type AiConfigurationSnapshot = {
  runtime: AgentRuntimeConfiguration;
  catalog: PlatformCatalog;
  dashboardResourceCount: number;
};

export type InvestigationPage = {
  data: Investigation[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  meta: {
    config: AgentRuntimeConfiguration;
    summary: Record<string, number>;
    incidents: Array<Record<string, unknown>>;
  };
};
