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
      ]),
      [
        { kind: "category", value: "Lentidão" },
        { kind: "category", value: "Sem conexão" },
        { kind: "channel", value: "WhatsApp" },
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
