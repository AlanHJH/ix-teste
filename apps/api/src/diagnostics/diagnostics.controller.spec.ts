import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDiagnosticFilters } from "./diagnostics.controller";

describe("parseDiagnosticFilters", () => {
  it("aceita filtros repetidos e preserva múltiplas escolhas", () => {
    assert.deepEqual(
      parseDiagnosticFilters([
        "state:Completed",
        "state:Error_Internal",
        "requestedBy:NOC",
        "olt:OLT-2",
        "testServer:speed.ondaluz.net.br",
      ]),
      [
        { kind: "state", value: "Completed" },
        { kind: "state", value: "Error_Internal" },
        { kind: "requestedBy", value: "NOC" },
        { kind: "olt", value: "OLT-2" },
        { kind: "testServer", value: "speed.ondaluz.net.br" },
      ],
    );
  });

  it("descarta tipos desconhecidos e valores vazios", () => {
    assert.deepEqual(
      parseDiagnosticFilters(["unsafe:x", "serial:", "customer"]),
      [],
    );
  });
});
