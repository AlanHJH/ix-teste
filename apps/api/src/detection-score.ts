export type DetectionScopeType =
  | "park"
  | "olt"
  | "pon"
  | "cto"
  | "customer"
  | "firmware"
  | "equipment"
  | "region"
  | "network";

export type DetectionSeverity = "critical" | "high" | "medium" | "low";

export type DetectionScoreInput = {
  scopeType: DetectionScopeType;
  affectedCpes: number;
  totalCpes: number;
  signal: "optical" | "fec" | "stability" | "capacity";
  growthRatio?: number;
  ticketCount?: number;
  escalationCount?: number;
  visitCount?: number;
  counterEvidenceCount?: number;
};

export type DetectionScore = {
  score: number;
  severity: DetectionSeverity;
  confidence: number;
  components: {
    reach: number;
    scope: number;
    signal: number;
    growth: number;
    operationalImpact: number;
    counterEvidence: number;
  };
};

export const DETECTION_RULE_VERSION = "detector-v2";

const scopeWeights: Record<DetectionScopeType, number> = {
  park: 1,
  network: 0.95,
  olt: 0.9,
  pon: 0.84,
  cto: 0.72,
  firmware: 0.82,
  equipment: 0.76,
  region: 0.68,
  customer: 0.42,
};

const signalWeights: Record<DetectionScoreInput["signal"], number> = {
  fec: 0.92,
  stability: 0.88,
  optical: 0.8,
  capacity: 0.76,
};

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(
    maximum,
    Math.max(minimum, Number.isFinite(value) ? value : 0),
  );
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function scoreDetectionCandidate(
  input: DetectionScoreInput,
): DetectionScore {
  const rawReach = clamp(
    input.totalCpes > 0 ? input.affectedCpes / input.totalCpes : 0,
  );
  const reach =
    input.scopeType === "customer" ? Math.min(0.35, rawReach) : rawReach;
  const volume = clamp(Math.log10(Math.max(input.affectedCpes, 0) + 1) / 2);
  const scope = scopeWeights[input.scopeType];
  const signal = signalWeights[input.signal];
  const growth = clamp(((input.growthRatio ?? 1) - 1) / 2);
  const affected = Math.max(input.affectedCpes, 1);
  const operationalImpact = clamp(
    ((input.ticketCount ?? 0) +
      2 * (input.escalationCount ?? 0) +
      1.5 * (input.visitCount ?? 0)) /
      (affected * 3),
  );
  const counterEvidence = clamp((input.counterEvidenceCount ?? 0) / 3);

  const confidence = clamp(
    0.35 +
      0.25 * reach +
      0.2 * signal +
      0.12 * growth +
      0.08 * scope -
      0.12 * counterEvidence,
  );
  const score = Math.round(
    100 *
      clamp(
        0.28 * reach +
          0.12 * volume +
          0.16 * scope +
          0.2 * signal +
          0.12 * growth +
          0.12 * operationalImpact -
          0.16 * counterEvidence,
      ),
  );
  const severity: DetectionSeverity =
    score >= 75
      ? "critical"
      : score >= 55
        ? "high"
        : score >= 35
          ? "medium"
          : "low";

  return {
    score,
    severity,
    confidence: round(confidence),
    components: {
      reach: round(reach),
      scope: round(scope),
      signal: round(signal),
      growth: round(growth),
      operationalImpact: round(operationalImpact),
      counterEvidence: round(counterEvidence),
    },
  };
}
