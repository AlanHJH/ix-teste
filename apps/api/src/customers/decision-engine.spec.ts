import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CustomerSignals, decideSupport } from "./decision-engine";

const base: CustomerSignals = {
  vendor: "Tuim",
  model: "TW-AC12",
  hwRevision: "B1",
  softwareVersion: "TW1.8.3_r221",
  planMbps: 300,
  previousPlanMbps: null,
  olt: "OLT-3",
  ponPort: "1/1",
  memMinPct: 50,
  rebootCount: 0,
  lanMinMbps: 1000,
  opticalRxMinDbm: -20,
  opticalLowDays: 0,
  wifiSignalRaw: 70,
  diagnosticRatio: 0.95,
};

describe("decideSupport", () => {
  it("prioriza incidente coletivo de fibra", () => {
    assert.equal(
      decideSupport({ ...base, olt: "OLT-2", ponPort: "1/7" }).action,
      "escalar_noc",
    );
    assert.match(
      decideSupport({ ...base, olt: "OLT-2", ponPort: "1/7" }).issue,
      /coletiva/,
    );
  });

  it("identifica incompatibilidade do Norvik A com plano acima de 100 Mbps", () => {
    const result = decideSupport({
      ...base,
      vendor: "Norvik",
      model: "NV-G1",
      hwRevision: "A",
      planMbps: 500,
      lanMinMbps: 100,
    });
    assert.equal(result.action, "agendar_visita");
    assert.match(result.issue, /100 Mbps/);
  });

  it("não compara qualidade Tuim como se fosse dBm", () => {
    const result = decideSupport({
      ...base,
      vendor: "Tuim",
      wifiSignalRaw: 25,
    });
    assert.equal(result.action, "resolver_telefone");
  });

  it("recomenda rollback para a regressão de firmware", () => {
    const result = decideSupport({
      ...base,
      vendor: "Kestrel",
      softwareVersion: "2.4.1",
      memMinPct: 7,
    });
    assert.equal(result.action, "escalar_noc");
    assert.match(result.issue, /firmware/);
  });

  it("agenda visita somente quando o sinal óptico ruim persiste", () => {
    const persistent = decideSupport({
      ...base,
      opticalRxMinDbm: -28.5,
      opticalLowDays: 2,
    });
    const transient = decideSupport({
      ...base,
      opticalRxMinDbm: -28.5,
      opticalLowDays: 1,
      wifiSignalRaw: 70,
    });
    assert.equal(persistent.action, "agendar_visita");
    assert.equal(transient.action, "escalar_noc");
  });

  it("mantém investigação humana quando nenhum sinal domina", () => {
    const result = decideSupport({
      ...base,
      wifiSignalRaw: 70,
      diagnosticRatio: null,
    });
    assert.equal(result.confidence, "Baixa");
    assert.equal(result.action, "escalar_noc");
  });
});
