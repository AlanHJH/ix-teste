import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isUrgentHealthReport } from "./n1-advisor.service";

describe("isUrgentHealthReport", () => {
  it("interrompe o fluxo técnico quando há possível excesso de medicamento", () => {
    assert.equal(
      isUrgentHealthReport("Tomei muito remédio e estou passando mal"),
      true,
    );
  });

  it("reconhece uma menção explícita a intoxicação", () => {
    assert.equal(isUrgentHealthReport("Acho que foi uma intoxicação"), true);
  });

  it("não trata uma pergunta técnica comum como urgência médica", () => {
    assert.equal(isUrgentHealthReport("O LED LOS ficou vermelho"), false);
  });
});
