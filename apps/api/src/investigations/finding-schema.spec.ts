import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateAgentFinding } from "./finding-schema";

const valid = {
  analysisVersion: "1.0",
  problemDetected: true,
  category: "optical_degradation",
  title: "Degradação compartilhada",
  severity: "high",
  confidence: 0.91,
  scope: {
    type: "network",
    identifier: "OLT-2/PON-1/7",
    olt: "OLT-2",
    pon: "1/7",
  },
  affectedCpes: 60,
  summary: "Aumento conjunto de erros.",
  probableCause: "Trecho óptico compartilhado.",
  recommendedAction: "Inspecionar o trecho comum.",
  evidence: [
    {
      source: "telemetry",
      reference: "telemetry_list_daily_metrics:OLT-2/1/7",
      summary: "FEC acima do baseline.",
    },
  ],
  counterEvidence: [],
  requiresHumanReview: true,
};

describe("validateAgentFinding", () => {
  it("aceita uma conclusão estruturada com revisão humana", () => {
    assert.equal(validateAgentFinding(valid).confidence, 0.91);
  });

  it("rejeita resultado que tenta dispensar a revisão humana", () => {
    assert.throws(
      () => validateAgentFinding({ ...valid, requiresHumanReview: false }),
      /contrato esperado/,
    );
  });

  it("rejeita evidência sem origem MCP conhecida", () => {
    assert.throws(
      () =>
        validateAgentFinding({
          ...valid,
          evidence: [{ source: "internet", reference: "x", summary: "x" }],
        }),
      /evidência inválida/,
    );
  });
});
