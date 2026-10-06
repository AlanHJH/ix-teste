import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { datasetResetSql } from "./dataset-reset";

describe("carga limpa do dataset", () => {
  it("trunca junto as tabelas que possuem relacionamento", () => {
    assert.equal(
      datasetResetSql,
      "TRUNCATE operational_incidents, inventory, tickets, diagnostics, informs",
    );
  });
});
