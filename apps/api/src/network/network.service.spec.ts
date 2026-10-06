import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DatabaseService } from "../database";
import { NetworkService } from "./network.service";

describe("NetworkService.closeDetectedGrouping", () => {
  it("persiste o encerramento de um agrupamento detectado", async () => {
    const queries: Array<{ text: string; params: unknown[] }> = [];
    const database = {
      async query(text: string, params: unknown[]) {
        queries.push({ text, params });
        return {
          rows: [{ grouping_id: "pon-olt2-ja", status: "resolved" }],
        };
      },
    } as unknown as DatabaseService;

    const result = await new NetworkService(database).closeDetectedGrouping(
      "PON-OLT2-JA",
      "resolved",
    );

    assert.deepEqual(result, {
      grouping_id: "pon-olt2-ja",
      status: "resolved",
    });
    assert.match(queries[0].text, /INSERT INTO detected_group_states/);
    assert.deepEqual(queries[0].params, ["pon-olt2-ja"]);
  });

  it("rejeita um identificador que não pertence aos detectores", async () => {
    const database = {
      async query() {
        throw new Error("não deveria consultar o banco");
      },
    } as unknown as DatabaseService;

    await assert.rejects(
      () =>
        new NetworkService(database).closeDetectedGrouping(
          "grupo-inexistente",
          "resolved",
        ),
      /Agrupamento não encontrado/,
    );
  });
});
