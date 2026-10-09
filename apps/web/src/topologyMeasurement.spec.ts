import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildHistoricalTopologyIssue } from "./topologyMeasurement";

describe("buildHistoricalTopologyIssue", () => {
  it("propaga uma indicação quando as falhas históricas predominam no ramo", () => {
    const issue = buildHistoricalTopologyIssue(
      { olt: "OLT-2", pon: "1/7" },
      { total: 34, completed: 14, errors: 20 },
      [{ state: "Timeout" }, { state: "NoResponse" }],
    );

    assert.equal(issue?.source, "measurements");
    assert.equal(issue?.scope.type, "pon");
    assert.equal(issue?.scope.cto, null);
    assert.match(issue?.technicalMessage ?? "", /20 de 34/);
    assert.match(issue?.technicalMessage ?? "", /offline provável/);
  });

  it("não transforma uma falha isolada ou minoritária em indisponibilidade coletiva", () => {
    assert.equal(
      buildHistoricalTopologyIssue(
        { olt: "OLT-2", pon: "1/8" },
        { total: 10, completed: 7, errors: 3 },
      ),
      null,
    );
    assert.equal(
      buildHistoricalTopologyIssue(
        { olt: "OLT-2", pon: "1/8", cto: "CTO-2-18-03" },
        { total: 1, completed: 0, errors: 1 },
      ),
      null,
    );
  });
});
