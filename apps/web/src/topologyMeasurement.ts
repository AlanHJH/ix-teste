import type { DiagnosticRecord, TopologyIssue } from "./types";

export type TopologyMeasurementScope = {
  olt: string;
  pon?: string;
  cto?: string;
};

export type HistoricalTopologyIssue = TopologyIssue & {
  source: "measurements";
  technicalMessage: string;
  measurement: {
    total: number;
    completed: number;
    errors: number;
    failureRate: number;
    states: string[];
  };
};

type MeasurementSummary = {
  total: number;
  completed: number;
  errors: number;
};

const errorStateLabels: Record<string, string> = {
  Timeout: "timeout",
  TimedOut: "timeout",
  Error_Timeout: "timeout",
  NoResponse: "sem resposta",
  "No response": "sem resposta",
  Error_NoResponse: "sem resposta",
  Error: "erro de execução",
};

function scopeType(scope: TopologyMeasurementScope): "olt" | "pon" | "cto" {
  return scope.cto ? "cto" : scope.pon ? "pon" : "olt";
}

function scopeLabel(scope: TopologyMeasurementScope) {
  if (scope.cto) return `CTO ${scope.cto}`;
  if (scope.pon) return `PON ${scope.pon} · ${scope.olt}`;
  return `OLT ${scope.olt}`;
}

function scopeIdentifier(scope: TopologyMeasurementScope) {
  if (scope.cto) return `${scope.olt} · PON ${scope.pon} · ${scope.cto}`;
  if (scope.pon) return `${scope.olt} · PON ${scope.pon}`;
  return scope.olt;
}

function failureSeverity(rate: number): TopologyIssue["severity"] {
  if (rate >= 0.8) return "critical";
  if (rate >= 0.6) return "high";
  return "medium";
}

function failureConfidence(rate: number, errors: number) {
  return Math.min(0.95, 0.55 + rate * 0.35 + Math.min(errors, 10) * 0.01);
}

function errorStateText(states: string[]) {
  const labels = states.map((state) => errorStateLabels[state] ?? state);
  if (labels.length === 0) return "estado diferente de Completed";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} e ${labels.at(-1)}`;
}

/**
 * Derives a topology indication from the historical diagnostic summary.
 * A single failed test is intentionally insufficient to mark a whole branch.
 */
export function buildHistoricalTopologyIssue(
  scope: TopologyMeasurementScope,
  summary: MeasurementSummary,
  records: Pick<DiagnosticRecord, "state">[] = [],
): HistoricalTopologyIssue | null {
  if (
    summary.total < 2 ||
    summary.errors < 2 ||
    summary.errors <= summary.completed
  ) {
    return null;
  }

  const failureRate = summary.errors / summary.total;
  const label = scopeLabel(scope);
  const stateNames = [
    ...new Set(
      records
        .filter((record) => record.state !== "Completed")
        .map((record) => record.state),
    ),
  ];
  const failureText = errorStateText(stateNames);
  const certainty =
    summary.completed === 0 ? "todos" : `${summary.errors} de ${summary.total}`;
  const technicalMessage =
    `Histórico de diagnósticos do ramo: ${certainty} testes retornaram ${failureText}; ` +
    `${summary.completed} concluíram. Os descendentes deste ponto aparecem como offline provável ` +
    `por propagação topológica. Isso indica uma indisponibilidade a partir de ${label}, ` +
    "mas não substitui uma confirmação em tempo real nem prova, sozinho, a causa física.";

  return {
    investigationId: `measurement:${scopeIdentifier(scope)}`,
    title: `Falha histórica de comunicação a partir da ${label}`,
    severity: failureSeverity(failureRate),
    confidence: failureConfidence(failureRate, summary.errors),
    status: "approved",
    scope: {
      type: scopeType(scope),
      identifier: scopeIdentifier(scope),
      olt: scope.olt,
      pon: scope.pon ?? null,
      cto: scope.cto ?? null,
    },
    affectedCpes: summary.errors,
    source: "measurements",
    technicalMessage,
    measurement: {
      ...summary,
      failureRate,
      states: stateNames,
    },
  };
}
