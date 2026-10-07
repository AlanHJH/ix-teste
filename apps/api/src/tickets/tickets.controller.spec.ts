import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTicketFilters } from "./tickets.controller";

describe("parseTicketFilters", () => {
  it("aceita filtros repetidos e preserva múltiplas escolhas", () => {
    assert.deepEqual(
      parseTicketFilters([
        "category:Lentidão",
        "category:Sem conexão",
        "channel:WhatsApp",
        "nocStatus:pending",
        "olt:OLT-2",
      ]),
      [
        { kind: "category", value: "Lentidão" },
        { kind: "category", value: "Sem conexão" },
        { kind: "channel", value: "WhatsApp" },
        { kind: "nocStatus", value: "pending" },
        { kind: "olt", value: "OLT-2" },
      ],
    );
  });

  it("descarta tipos desconhecidos e valores vazios", () => {
    assert.deepEqual(
      parseTicketFilters(["unsafe:x", "customer:", "ticket"]),
      [],
    );
  });
});
