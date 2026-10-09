import type {
  TicketTriageAction,
  TicketTriageDecision,
} from "./ticket-triage.types";

export type TicketTriagePolicyResult = {
  status: "completed" | "needs_review";
  reclassify: boolean;
  escalateNoc: boolean;
  close: boolean;
  actionApplied:
    "none" | "reclassified" | "escalated_noc" | "closed" | "review";
  reviewRequired: boolean;
};

export function ticketTriageMinConfidence(
  environment: NodeJS.ProcessEnv = process.env,
): number {
  const parsed = Number(environment.TICKET_TRIAGE_MIN_CONFIDENCE);
  if (!Number.isFinite(parsed)) return 0.9;
  return Math.max(0, Math.min(1, parsed));
}

export function ticketTriageAutoCloseEnabled(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return environment.TICKET_TRIAGE_AUTO_CLOSE === "true";
}

export function decideTicketTriagePolicy(
  decision: TicketTriageDecision,
  currentCategory: string,
  ticketIsOpen: boolean,
  environment: NodeJS.ProcessEnv = process.env,
): TicketTriagePolicyResult {
  const confidenceIsHigh =
    decision.confidence >= ticketTriageMinConfidence(environment);
  const categoryChanged = currentCategory !== decision.suggestedCategory;
  const safeDecision = confidenceIsHigh && !decision.requiresHumanReview;
  const reclassify =
    safeDecision &&
    categoryChanged &&
    decision.action === ("reclassify" satisfies TicketTriageAction);
  const escalateNoc =
    safeDecision &&
    ticketIsOpen &&
    decision.caseScope === "shared" &&
    decision.nocCandidate &&
    decision.action === ("escalate_noc" satisfies TicketTriageAction);
  const close =
    ticketTriageAutoCloseEnabled(environment) &&
    safeDecision &&
    ticketIsOpen &&
    decision.action === ("close" satisfies TicketTriageAction);
  const actionApplied = close
    ? "closed"
    : escalateNoc
      ? "escalated_noc"
      : reclassify
        ? "reclassified"
        : safeDecision && decision.action === "keep_category"
          ? "none"
          : "review";
  const reviewRequired = actionApplied === "review";
  return {
    status: reviewRequired ? "needs_review" : "completed",
    reclassify,
    escalateNoc,
    close,
    actionApplied,
    reviewRequired,
  };
}
