import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreDetectionCandidate } from "./detection-score";

describe("scoreDetectionCandidate", () => {
  it("prioriza um problema compartilhado que cresce e gera impacto", () => {
    const result = scoreDetectionCandidate({
      scopeType: "pon",
      affectedCpes: 40,
      totalCpes: 50,
      signal: "fec",
      growthRatio: 3,
      ticketCount: 12,
      escalationCount: 4,
      visitCount: 2,
    });

    assert.equal(result.severity, "critical");
    assert.ok(result.score >= 75);
    assert.ok(result.confidence >= 0.7);
    assert.equal(result.components.growth, 1);
  });

  it("reduz prioridade quando o caso é isolado e tem contraindícios", () => {
    const result = scoreDetectionCandidate({
      scopeType: "customer",
      affectedCpes: 1,
      totalCpes: 1,
      signal: "optical",
      counterEvidenceCount: 3,
    });

    assert.equal(result.severity, "low");
    assert.ok(result.score < 45);
    assert.ok(result.confidence < 0.6);
  });
});
