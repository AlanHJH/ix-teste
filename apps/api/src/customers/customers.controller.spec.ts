import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseInventoryFilters } from "./customers.controller";

describe("parseInventoryFilters", () => {
  it("aceita filtros conhecidos e preserva múltiplas seleções", () => {
    assert.deepEqual(
      parseInventoryFilters(["olt:OLT-4", "model:KX-3000", "plan:500"]),
      [
        { kind: "olt", value: "OLT-4" },
        { kind: "model", value: "KX-3000" },
        { kind: "plan", value: "500" },
      ],
    );
  });

  it("descarta tipos desconhecidos e valores vazios", () => {
    assert.deepEqual(parseInventoryFilters(["unsafe:x", "olt:", "serial"]), []);
  });
});
