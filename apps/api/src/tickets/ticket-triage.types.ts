import type { TicketCategory } from "./domain/ticket";

export type TicketTriageStatus =
  "unprocessed" | "running" | "completed" | "needs_review" | "failed";

export type TicketTriageAction =
  | "keep_category"
  | "reclassify"
  | "escalate_noc"
  | "schedule_visit"
  | "close"
  | "review";

export type TicketCaseScope = "individual" | "shared" | "uncertain";

export type TicketTriageDecision = {
  analysisVersion: "1.0";
  suggestedCategory: TicketCategory;
  categoryCorrect: boolean;
  caseScope: TicketCaseScope;
  nocCandidate: boolean;
  confidence: number;
  action: TicketTriageAction;
  reason: string;
  nocReason: string;
  evidence: string[];
  requiresHumanReview: boolean;
};

export type TicketTriageTicketSnapshot = {
  ticket_id: string;
  opened_at: string;
  customer_id: string;
  channel: string;
  category: string;
  description: string;
  resolution: string;
  closed_at: string | null;
  source: string;
  opened_by: string | null;
  related_problem_id: string | null;
  noc_status: string;
  source_payload: Record<string, unknown>;
  city: string | null;
  neighborhood: string | null;
  olt: string | null;
  pon: string | null;
  cto: string | null;
};

export type TicketTriageContext = {
  ticket: TicketTriageTicketSnapshot;
  customer: {
    customerId: string;
    status: string | null;
    customerSince: string | null;
    cancelledAt: string | null;
    equipmentCount: number;
    activeEquipmentCount: number;
    activePlanMbps: number | null;
  };
  equipment: {
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
    installedAt: string | null;
    planSince: string | null;
  } | null;
  recentMetrics: Array<Record<string, unknown>>;
  recentLogs: Array<Record<string, unknown>>;
  recentDiagnostics: Array<Record<string, unknown>>;
  recentCustomerTickets: Array<{
    ticket_id: string;
    opened_at: string;
    channel: string;
    category: string;
    description: string;
    resolution: string;
    source: string;
    related_problem_id: string | null;
    ai_triage_status: string;
  }>;
  relatedTickets: Array<{
    ticket_id: string;
    opened_at: string;
    customer_id: string;
    channel: string;
    category: string;
    description: string;
    resolution: string;
    source: string;
    related_problem_id: string | null;
    ai_triage_status: string;
    relation: string;
    serial: string | null;
    firmware: string | null;
    olt: string | null;
    pon: string | null;
    cto: string | null;
    city: string | null;
    neighborhood: string | null;
  }>;
  correlation: {
    windowStart: string;
    windowEnd: string;
    relatedTicketCount: number;
    relatedCustomerCount: number;
    relatedEquipmentCount: number;
    relationCounts: Record<string, number>;
    activeIncidentCount: number;
  };
  activeIncidents: Array<{
    incident_id: string;
    status: string;
    severity: string;
    title: string;
    scope: Record<string, unknown>;
    affected_cpes: number;
    confidence: number;
    probable_cause: string;
    recommended_action: string;
    evidence: unknown;
    opened_at: string;
    origin_ticket_id: string | null;
  }>;
  timeline: Array<{
    at: string;
    source: string;
    kind: string;
    reference: string;
    summary: string;
  }>;
  evidenceBundle: Array<{
    source: string;
    reference: string;
    observedAt: string | null;
    summary: string;
    details: Record<string, unknown>;
  }>;
  dataQuality: {
    checked: string[];
    missing: string[];
    latestMetricAt: string | null;
    latestLogAt: string | null;
    latestDiagnosticAt: string | null;
  };
};

export type TicketTriageAnalysis = {
  decision: TicketTriageDecision;
  model: string;
  responseId: string;
};
