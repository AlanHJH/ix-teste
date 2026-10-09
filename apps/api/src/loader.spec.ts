import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { datasetResetSql } from "./dataset-reset";

describe("carga limpa do dataset", () => {
  it("trunca junto as tabelas que possuem relacionamento", () => {
    assert.equal(
      datasetResetSql,
      "TRUNCATE ticket_ai_triage_runs, operational_incidents, inventory, tickets, diagnostics, informs",
    );
  });
});
