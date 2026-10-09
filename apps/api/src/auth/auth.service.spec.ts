import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  it("emite e valida um JWT para cada usuário de demonstração", () => {
    const auth = new AuthService();
    for (const username of ["marina", "lucas", "renata"]) {
      const result = auth.login(username, "Teste@123");
      assert.match(result.accessToken, /^[^.]+\.[^.]+\.[^.]+$/);
      assert.equal(auth.verifyToken(result.accessToken)?.username, username);
      assert.equal(result.tokenType, "Bearer");
    }
  });

  it("recusa senha incorreta e token adulterado", () => {
    const auth = new AuthService();
    assert.throws(() => auth.login("marina", "senha-errada"), /inválidos/);
    const token = auth.login("marina", "Teste@123").accessToken;
    assert.equal(auth.verifyToken(`${token}x`), null);
  });
});
