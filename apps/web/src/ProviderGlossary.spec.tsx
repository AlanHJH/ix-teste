import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { technicalHintForLabel, TechnicalText } from "./ProviderGlossary";

describe("TechnicalText", () => {
  it("anota siglas, unidades e variações de hífen", () => {
    const html = renderToStaticMarkup(
      <TechnicalText text="NOC: validar PON, FEC, TR‑143 e -27 dBm." />,
    );

    assert.equal((html.match(/class="provider-term"/g) ?? []).length, 5);
    assert.match(html, /Centro de Operações de Rede/);
    assert.match(html, /Teste remoto de download e upload/);
  });

  it("não reconhece uma sigla dentro de outra palavra", () => {
    const html = renderToStaticMarkup(
      <TechnicalText text="O plano foi alterado." />,
    );

    assert.doesNotMatch(html, /class="provider-term"/);
  });

  it("explica labels técnicos usados nos detalhes de rede", () => {
    assert.match(
      technicalHintForLabel("Potência RX mínima") ?? "",
      /potência.*CPE/i,
    );
    assert.match(
      technicalHintForLabel("CPEs ativas") ?? "",
      /Equipamento instalado no cliente/i,
    );
    assert.equal(technicalHintForLabel("Status"), undefined);
  });
});
