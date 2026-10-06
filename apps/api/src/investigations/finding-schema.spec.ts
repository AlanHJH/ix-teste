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
    cto: null,
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

  it("aceita todos os escopos usados na criação de agrupamentos", () => {
    const scopes = [
      {
        type: "park",
        identifier: "Todo o parque",
        olt: null,
        pon: null,
        cto: null,
      },
      { type: "olt", identifier: "OLT-2", olt: "OLT-2", pon: null, cto: null },
      {
        type: "pon",
        identifier: "OLT-2 · PON 1/7",
        olt: "OLT-2",
        pon: "1/7",
        cto: null,
      },
      {
        type: "cto",
        identifier: "OLT-2 · PON 1/7 · CTO-2-17-01",
        olt: "OLT-2",
        pon: "1/7",
        cto: "CTO-2-17-01",
      },
      {
        type: "customer",
        identifier: "C545968",
        olt: "OLT-2",
        pon: "1/7",
        cto: "CTO-2-17-01",
      },
      {
        type: "firmware",
        identifier: "2.4.1",
        olt: null,
        pon: null,
        cto: null,
      },
      {
        type: "equipment",
        identifier: "Norvik NV-G1 A",
        olt: null,
        pon: null,
        cto: null,
      },
      {
        type: "region",
        identifier: "Jardim Aurora",
        olt: null,
        pon: null,
        cto: null,
      },
    ];

    for (const scope of scopes) {
      assert.equal(
        validateAgentFinding({ ...valid, scope }).scope.type,
        scope.type,
      );
    }
  });

  it("rejeita uma PON sem OLT e uma CTO sem caminho completo", () => {
    assert.throws(
      () =>
        validateAgentFinding({
          ...valid,
          scope: {
            type: "pon",
            identifier: "1/7",
            olt: null,
            pon: "1/7",
            cto: null,
          },
        }),
      /escopo proposto.*incompleto/i,
    );
    assert.throws(
      () =>
        validateAgentFinding({
          ...valid,
          scope: {
            type: "cto",
            identifier: "CTO-1",
            olt: "OLT-2",
            pon: null,
            cto: "CTO-1",
          },
        }),
      /escopo proposto.*incompleto/i,
    );
  });
});
