import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideTicketTriagePolicy } from "./ticket-triage-policy";
import type { TicketTriageDecision } from "./ticket-triage.types";

const baseDecision: TicketTriageDecision = {
  analysisVersion: "1.0",
  suggestedCategory: "Sem conexão",
  categoryCorrect: false,
  caseScope: "individual",
  nocCandidate: false,
  confidence: 0.96,
  action: "reclassify",
  reason: "O relato informa perda completa de conexão.",
  nocReason: "Não há evidência de alcance compartilhado.",
  evidence: ["O cliente relata ausência total de conexão."],
  requiresHumanReview: false,
};

describe("decideTicketTriagePolicy", () => {
  it("corrige a categoria de um atendimento N1 com alta confiança", () => {
    const result = decideTicketTriagePolicy(baseDecision, "Lentidão", true, {
      TICKET_TRIAGE_MIN_CONFIDENCE: "0.9",
    });
    assert.deepEqual(result, {
      status: "completed",
      reclassify: true,
      escalateNoc: false,
      close: false,
      actionApplied: "reclassified",
      reviewRequired: false,
    });
  });

  it("encaminha um candidato compartilhado ao NOC sem criar incidente", () => {
    const result = decideTicketTriagePolicy(
      {
        ...baseDecision,
        suggestedCategory: "Sem conexão",
        categoryCorrect: true,
        caseScope: "shared",
        nocCandidate: true,
        action: "escalate_noc",
      },
      "Sem conexão",
      true,
      { TICKET_TRIAGE_MIN_CONFIDENCE: "0.9" },
    );
    assert.equal(result.actionApplied, "escalated_noc");
    assert.equal(result.status, "completed");
  });

  it("manda baixa confiança para revisão e não altera o ticket", () => {
    const result = decideTicketTriagePolicy(
      { ...baseDecision, confidence: 0.61 },
      "Lentidão",
      true,
      { TICKET_TRIAGE_MIN_CONFIDENCE: "0.9" },
    );
    assert.equal(result.status, "needs_review");
    assert.equal(result.actionApplied, "review");
    assert.equal(result.reclassify, false);
  });

  it("não encerra automaticamente por padrão", () => {
    const result = decideTicketTriagePolicy(
      { ...baseDecision, action: "close", categoryCorrect: true },
      "Sem conexão",
      true,
      { TICKET_TRIAGE_MIN_CONFIDENCE: "0.9" },
    );
    assert.equal(result.status, "needs_review");
    assert.equal(result.close, false);
  });
});
