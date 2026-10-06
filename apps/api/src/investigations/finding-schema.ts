import { AgentFinding } from "./investigation.types";

const evidenceSchema = {
  type: "object",
  properties: {
    source: {
      type: "string",
      enum: [
        "customers",
        "inventory",
        "telemetry",
        "diagnostics",
        "tickets",
        "operations",
      ],
    },
    reference: { type: "string" },
    summary: { type: "string" },
  },
  required: ["source", "reference", "summary"],
  additionalProperties: false,
} as const;

export const agentFindingJsonSchema = {
  type: "object",
  properties: {
    analysisVersion: { type: "string", enum: ["1.0"] },
    problemDetected: { type: "boolean" },
    category: {
      type: "string",
      enum: [
        "optical_degradation",
        "firmware_regression",
        "capacity_mismatch",
        "individual_failure",
        "other",
        "no_problem",
        "inconclusive",
      ],
    },
    title: { type: "string" },
    severity: {
      type: "string",
      enum: ["critical", "high", "medium", "low"],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    scope: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: [
            "park",
            "olt",
            "pon",
            "cto",
            "customer",
            "firmware",
            "equipment",
            "region",
            "network",
          ],
        },
        identifier: { type: "string" },
        olt: { type: ["string", "null"] },
        pon: { type: ["string", "null"] },
        cto: { type: ["string", "null"] },
      },
      required: ["type", "identifier", "olt", "pon", "cto"],
      additionalProperties: false,
    },
    affectedCpes: { type: "integer", minimum: 0 },
    summary: { type: "string" },
    probableCause: { type: "string" },
    recommendedAction: { type: "string" },
    evidence: {
      type: "array",
      items: evidenceSchema,
      maxItems: 12,
    },
    counterEvidence: {
      type: "array",
      items: evidenceSchema,
      maxItems: 12,
    },
    requiresHumanReview: { type: "boolean", enum: [true] },
  },
  required: [
    "analysisVersion",
    "problemDetected",
    "category",
    "title",
    "severity",
    "confidence",
    "scope",
    "affectedCpes",
    "summary",
    "probableCause",
    "recommendedAction",
    "evidence",
    "counterEvidence",
    "requiresHumanReview",
  ],
  additionalProperties: false,
} as const;

const categories = new Set([
  "optical_degradation",
  "firmware_regression",
  "capacity_mismatch",
  "individual_failure",
  "other",
  "no_problem",
  "inconclusive",
]);
const severities = new Set(["critical", "high", "medium", "low"]);
const scopeTypes = new Set([
  "park",
  "olt",
  "pon",
  "cto",
  "region",
  "network",
  "firmware",
  "equipment",
  "customer",
]);
const evidenceSources = new Set([
  "customers",
  "inventory",
  "telemetry",
  "diagnostics",
  "tickets",
  "operations",
]);

export function validateAgentFinding(value: unknown): AgentFinding {
  if (!value || typeof value !== "object") {
    throw new Error("A OpenAI não retornou uma conclusão estruturada.");
  }
  const finding = value as Record<string, unknown>;
  const scope = finding.scope as Record<string, unknown> | undefined;
  if (
    finding.analysisVersion !== "1.0" ||
    typeof finding.problemDetected !== "boolean" ||
    !categories.has(String(finding.category)) ||
    !severities.has(String(finding.severity)) ||
    typeof finding.title !== "string" ||
    typeof finding.confidence !== "number" ||
    finding.confidence < 0 ||
    finding.confidence > 1 ||
    typeof finding.affectedCpes !== "number" ||
    !Number.isInteger(finding.affectedCpes) ||
    !scope ||
    !scopeTypes.has(String(scope.type)) ||
    typeof scope.identifier !== "string" ||
    typeof finding.summary !== "string" ||
    typeof finding.probableCause !== "string" ||
    typeof finding.recommendedAction !== "string" ||
    finding.requiresHumanReview !== true
  ) {
    throw new Error("A conclusão da OpenAI não respeitou o contrato esperado.");
  }

  const scopeType = String(scope.type);
  const identifier = String(scope.identifier).trim();
  const olt = typeof scope.olt === "string" ? scope.olt.trim() : "";
  const pon = typeof scope.pon === "string" ? scope.pon.trim() : "";
  const cto = typeof scope.cto === "string" ? scope.cto.trim() : "";
  if (
    !identifier ||
    (scopeType === "olt" && !olt) ||
    (["pon", "network"].includes(scopeType) && (!olt || !pon)) ||
    (scopeType === "cto" && (!olt || !pon || !cto)) ||
    (finding.problemDetected && finding.affectedCpes < 1)
  ) {
    throw new Error("O escopo proposto pela OpenAI está incompleto.");
  }

  for (const key of ["evidence", "counterEvidence"] as const) {
    const entries = finding[key];
    if (!Array.isArray(entries)) {
      throw new Error(`O campo ${key} não é uma lista.`);
    }
    for (const entry of entries) {
      if (
        !entry ||
        typeof entry !== "object" ||
        !evidenceSources.has(
          String((entry as Record<string, unknown>).source),
        ) ||
        typeof (entry as Record<string, unknown>).reference !== "string" ||
        typeof (entry as Record<string, unknown>).summary !== "string"
      ) {
        throw new Error(`O campo ${key} contém uma evidência inválida.`);
      }
    }
  }

  return value as AgentFinding;
}
