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
  } | null;
  recentMetrics: Array<Record<string, unknown>>;
  recentLogs: Array<Record<string, unknown>>;
  recentDiagnostics: Array<Record<string, unknown>>;
  recentCustomerTickets: Array<{
    ticket_id: string;
    opened_at: string;
    category: string;
    description: string;
    resolution: string;
    related_problem_id: string | null;
  }>;
};

export type TicketTriageAnalysis = {
  decision: TicketTriageDecision;
  model: string;
  responseId: string;
};
