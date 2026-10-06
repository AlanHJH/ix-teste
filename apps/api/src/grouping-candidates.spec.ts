import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Queryable } from "./mcp/shared/infrastructure/database";
import { listGroupingCandidates } from "./grouping-candidates";

describe("listGroupingCandidates", () => {
  it("normaliza um candidato de PON para o contrato do agente", async () => {
    const calls: Array<{ text: string; params: unknown[] }> = [];
    const database = {
      async query(text: string, params: unknown[] = []) {
        calls.push({ text, params });
        return {
          rows: [
            {
              scope_type: "pon",
              identifier: "OLT-2 · PON 1/7",
              olt: "OLT-2",
              pon: "1/7",
              cto: null,
              signal: "fec",
              affected_cpes: 56,
              total_cpes: 62,
              affected_percent: 90.3,
              peak_signal_value: 3421572,
            },
          ],
        };
      },
    } as unknown as Queryable;

    const result = await listGroupingCandidates(database, {
      scopeType: "pon",
      limit: 4,
    });

    assert.equal(result[0].candidateKey, "pon:olt-2 · pon 1/7:fec:olt-2:1/7:");
    assert.deepEqual(result[0].scope, {
      type: "pon",
      identifier: "OLT-2 · PON 1/7",
      olt: "OLT-2",
      pon: "1/7",
      cto: null,
    });
    assert.match(result[0].summary, /56 de 62 CPEs \(90.3%\)/);
    assert.deepEqual(calls[0].params, ["pon", 4]);
    assert.match(calls[0].text, /WHEN 'cto'/);
    assert.match(calls[0].text, /WHEN 'region'/);
  });

  it("limita o volume devolvido ao agente", async () => {
    const database = {
      async query(_text: string, params: unknown[]) {
        assert.deepEqual(params, ["", 30]);
        return { rows: [] };
      },
    } as unknown as Queryable;

    assert.deepEqual(
      await listGroupingCandidates(database, { limit: 999 }),
      [],
    );
  });
});
