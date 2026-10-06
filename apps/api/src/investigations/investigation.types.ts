export type InvestigationTrigger = "metric" | "schedule" | "manual";

export type InvestigationStatus =
  | "queued"
  | "running"
  | "no_problem"
  | "inconclusive"
  | "pending_review"
  | "approved"
  | "rejected"
  | "failed";

export type InvestigationRequest = {
  triggerType: InvestigationTrigger;
  triggerLabel: string;
  objective: string;
  scope: Record<string, unknown>;
  dedupKey: string;
};

export type FindingEvidence = {
  source:
    | "customers"
    | "inventory"
    | "telemetry"
    | "diagnostics"
    | "tickets"
    | "operations";
  reference: string;
  summary: string;
};

export type AgentFinding = {
  analysisVersion: "1.0";
  problemDetected: boolean;
  category:
    | "optical_degradation"
    | "firmware_regression"
    | "capacity_mismatch"
    | "individual_failure"
    | "other"
    | "no_problem"
    | "inconclusive";
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
  evidence: FindingEvidence[];
  counterEvidence: FindingEvidence[];
  requiresHumanReview: true;
};

export type ToolTrace = {
  domain: string;
  tool: string;
  arguments: Record<string, unknown>;
  outputPreview: string;
};

export type AgentAnalysis = {
  finding: AgentFinding;
  model: string;
  responseId: string;
  toolTrace: ToolTrace[];
};
