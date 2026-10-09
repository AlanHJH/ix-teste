import type {
  OperationalIncident,
  SupportProfile,
  TopologyFocus,
} from "./types";

const connectionTerms = [
  "fibra",
  "óptica",
  "optica",
  "sinal",
  "pon",
  "olt",
  "cto",
  "conexão",
  "conexao",
  "conectividade",
  "internet",
  "link",
  "wi-fi",
  "wifi",
  "sem acesso",
  "indisponibilidade",
  "queda de conexão",
  "queda de conexao",
];

function normalized(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("pt-BR").replaceAll("‑", "-") ?? "";
}

function isConnectionText(value: string) {
  const text = normalized(value);
  return connectionTerms.some((term) => text.includes(term));
}

function connectionScope(profile: SupportProfile) {
  const path = profile.equipment.network
    .split(" · ")
    .map((item) => item.trim())
    .filter(Boolean);
  const pon = path.find((item) => /^pon\s+/i.test(item));
  const cto = path.find((item) => /^cto(?:\s+|-)/i.test(item));

  return {
    type: "customer",
    identifier: profile.customer.id,
    olt: path[0] ?? null,
    pon: pon?.replace(/^pon\s+/i, "") ?? null,
    cto: cto ?? null,
  };
}

function focusFromIncident(incident: {
  incidentId: string;
  title: string;
  severity: TopologyFocus["severity"];
  confidence: number;
  scope: {
    type?: string;
    identifier?: string;
    olt?: string | null;
    pon?: string | null;
    cto?: string | null;
  };
  affectedCpes: number;
  kind: TopologyFocus["kind"];
}): TopologyFocus {
  return {
    id: incident.incidentId,
    kind: incident.kind,
    title: incident.title,
    severity: incident.severity,
    confidence: incident.confidence,
    scope: {
      type: incident.scope.type ?? "customer",
      identifier: incident.scope.identifier ?? incident.incidentId,
      olt: incident.scope.olt ?? null,
      pon: incident.scope.pon ?? null,
      cto: incident.scope.cto ?? null,
    },
    affectedCpes: incident.affectedCpes,
  };
}

export function topologyFocusFromIncident(
  incident: OperationalIncident,
): TopologyFocus {
  return focusFromIncident({
    incidentId: incident.incident_id,
    title: incident.title,
    severity: incident.severity,
    confidence: incident.confidence,
    scope: incident.scope,
    affectedCpes: incident.affected_cpes,
    kind: "grouping",
  });
}

export function topologyFocusFromSupport(
  profile: SupportProfile,
): TopologyFocus | null {
  const relatedIncident = [
    ...profile.activeIncidents,
    ...profile.problemHistory,
  ].find(
    (incident) => incident.incidentId === profile.decision.relatedProblemId,
  );
  const candidateIncident = relatedIncident ?? profile.activeIncidents[0];
  const candidateText = [
    profile.decision.issue,
    profile.decision.relatedProblemTitle,
    ...profile.decision.reasons,
    ...profile.activeIncidents.flatMap((incident) => [
      incident.title,
      incident.category,
      incident.probableCause,
      incident.recommendedAction,
    ]),
  ]
    .filter(Boolean)
    .join(" ");

  if (!isConnectionText(candidateText)) return null;
  if (candidateIncident) {
    return focusFromIncident({ ...candidateIncident, kind: "connection" });
  }

  return {
    id: `connection-${profile.customer.id}`,
    kind: "connection",
    title: profile.decision.issue,
    severity: "high",
    confidence: 0,
    scope: connectionScope(profile),
    affectedCpes: 1,
  };
}
