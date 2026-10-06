import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alignInfrastructureMetricBindings,
  fallbackDashboardPlan,
  validateDashboardPlan,
} from "./dashboard-plan";

describe("plano do dashboard dinâmico", () => {
  it("prioriza fila e reincidência quando o pedido é sobre suporte", () => {
    const plan = fallbackDashboardPlan(
      "Quero acompanhar a fila do suporte N1 e clientes reincidentes.",
    );
    assert.equal(plan.title, "Pulso do atendimento");
    assert.ok(
      plan.widgets.some((item) => item.binding === "operations.nocQueue"),
    );
    assert.ok(
      plan.widgets.some((item) => item.binding === "overview.repeatCustomers"),
    );
  });

  it("usa métricas distintas para OLTs e portas PON", () => {
    const plan = fallbackDashboardPlan(
      "Mostre a quantidade de OLTs e PONs ativas.",
    );
    assert.ok(
      plan.widgets.some((item) => item.binding === "overview.oltCount"),
    );
    assert.ok(
      plan.widgets.some((item) => item.binding === "overview.ponCount"),
    );
  });

  it("corrige um plano da IA que reutilizou a métrica de CPEs", () => {
    const plan = fallbackDashboardPlan("Mostre a saúde geral da operação.");
    plan.widgets[0] = {
      ...plan.widgets[0],
      title: "Quantidade de OLTs",
      binding: "overview.activeCpes",
    };
    plan.widgets[1] = {
      ...plan.widgets[1],
      title: "Quantidade de PONs",
      binding: "overview.activeCpes",
    };
    const aligned = alignInfrastructureMetricBindings(plan);
    assert.equal(aligned.widgets[0].binding, "overview.oltCount");
    assert.equal(aligned.widgets[1].binding, "overview.ponCount");
  });

  it("oferece composição rica com fórmula, gráficos, mapa e tabelas", () => {
    const plan = fallbackDashboardPlan(
      "Crie tabelas, gráficos de barra e pizza, mapa, topologia, telemetria, diagnóstico e fórmula.",
    );
    const kinds = new Set(plan.widgets.map((item) => item.kind));
    for (const kind of [
      "metric",
      "bar",
      "pie",
      "multiseries",
      "topology",
      "map",
      "table",
    ]) {
      assert.ok(kinds.has(kind as never), `faltou ${kind}`);
    }
    assert.ok(plan.widgets.some((item) => item.config.formula));
    assert.equal(validateDashboardPlan(plan), plan);
  });

  it("rejeita binding incompatível com o tipo visual", () => {
    const plan = fallbackDashboardPlan("Mostre os principais alertas da rede.");
    plan.widgets[0] = {
      ...plan.widgets[0],
      kind: "metric",
      binding: "overview.weeklyTickets",
    };
    assert.throws(() => validateDashboardPlan(plan), /incompatível/);
  });

  it("aceita o plano seguro padrão", () => {
    const plan = fallbackDashboardPlan("Mostre a saúde geral da operação.");
    assert.equal(validateDashboardPlan(plan), plan);
    assert.ok(
      plan.widgets.every((item) => item.columns >= 4 && item.columns <= 24),
    );
  });

  it("migra blocos antigos para a grade de 24 colunas", () => {
    const plan = fallbackDashboardPlan("Mostre a saúde geral da operação.");
    delete (plan.widgets[0] as Partial<(typeof plan.widgets)[number]>).columns;
    const validated = validateDashboardPlan(plan);
    assert.equal(validated.widgets[0].columns, 8);
  });

  it("rejeita largura fora da grade de 24 colunas", () => {
    const plan = fallbackDashboardPlan("Mostre a saúde geral da operação.");
    plan.widgets[0].columns = 25;
    assert.throws(() => validateDashboardPlan(plan), /incompatível/);
  });
});
