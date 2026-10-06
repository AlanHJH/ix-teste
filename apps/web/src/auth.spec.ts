import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessView, defaultViewFor, demoUsers, parseSession } from "./auth";

describe("pseudo autenticação", () => {
  it("oferece exatamente os três perfis do protótipo", () => {
    assert.deepEqual(
      demoUsers.map(({ role, name }) => ({ role, name })),
      [
        { role: "admin", name: "Marina Costa" },
        { role: "n1", name: "Lucas Ferreira" },
        { role: "noc", name: "Renata Alves" },
      ],
    );
  });

  it("abre cada papel na sua área principal", () => {
    assert.equal(defaultViewFor("admin"), "dashboard");
    assert.equal(defaultViewFor("n1"), "support");
    assert.equal(defaultViewFor("noc"), "noc");
  });

  it("restringe configuração ao admin e separa N1 de NOC", () => {
    assert.equal(canAccessView("admin", "agent-config"), true);
    assert.equal(canAccessView("n1", "support"), true);
    assert.equal(canAccessView("n1", "noc"), false);
    assert.equal(canAccessView("noc", "noc"), true);
    assert.equal(canAccessView("noc", "support"), false);
  });

  it("restaura apenas usuários conhecidos", () => {
    assert.equal(parseSession('{"id":"n1-lucas"}')?.role, "n1");
    assert.equal(parseSession('{"id":"desconhecido"}'), null);
    assert.equal(parseSession("não é json"), null);
  });
});
