import assert from "node:assert/strict";
import test from "node:test";
import type { SupportProfile } from "./types";
import { topologyFocusFromSupport } from "./topologyFocus";

function profile(issue: string): SupportProfile {
  return {
    customer: {
      id: "C545968",
      city: "São Paulo",
      neighborhood: "Jardim Aurora",
    },
    equipment: {
      serial: "SN-001",
      vendor: "Nokia",
      model: "G-1426G-A",
      hardware: "1.0",
      firmware: "3.2.1",
      planMbps: 500,
      previousPlanMbps: null,
      planSince: "2026-01-01",
      network: "OLT-2 · PON 1/8 · CTO-2-18-01",
    },
    metrics: {
      mem_min_pct: 70,
      reboot_count: 0,
      lan_min_mbps: 500,
      optical_rx_min_dbm: -18,
      optical_low_days: 0,
      wifi_signal_raw: null,
      last_day: "2026-10-08",
      diagnostic: null,
    },
    decision: {
      issue,
      confidence: "Alta",
      action: "escalar_noc",
      actionLabel: "Escalar",
      sayToCustomer: "Vamos verificar a conexão.",
      operatorSteps: [],
      reasons: [],
      relatedProblemId: null,
      relatedProblemTitle: null,
      relatedProblemKind: null,
    },
    preflight: {
      infrastructureChecked: true,
      measurementsChecked: true,
      nocHistoryChecked: true,
      relatedHistoryFound: false,
      measurementStatus: "new_signal",
      mainAdvice: "Aguardar a análise.",
      escalation: { required: true, target: "NOC", reason: "Sinal novo." },
    },
    problemHistory: [],
    activeIncidents: [],
    recentTickets: [],
    allTickets: [],
  };
}

test("abre o foco da topologia para uma falha de fibra", () => {
  const focus = topologyFocusFromSupport(profile("Falha na fibra óptica"));

  assert.ok(focus);
  assert.equal(focus.scope.olt, "OLT-2");
  assert.equal(focus.scope.pon, "1/8");
  assert.equal(focus.scope.cto, "CTO-2-18-01");
  assert.equal(focus.scope.identifier, "C545968");
});

test("não abre o foco para uma instabilidade de firmware isolada", () => {
  assert.equal(
    topologyFocusFromSupport(profile("Instabilidade de firmware")),
    null,
  );
});

test("trata cobertura Wi-Fi como problema de conexão", () => {
  const focus = topologyFocusFromSupport(
    profile("Cobertura Wi‑Fi dentro da residência"),
  );

  assert.ok(focus);
  assert.equal(focus.scope.type, "customer");
});
