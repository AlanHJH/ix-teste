import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DatabaseService } from "../database";
import { IncidentsService } from "../incidents/incidents.service";
import { InvestigationsService } from "./investigations.service";
import { OpenAIInvestigationAgent } from "./openai-investigation-agent";

const finding = {
  analysisVersion: "1.0" as const,
  problemDetected: true,
  category: "optical_degradation" as const,
  title: "Degradação compartilhada na PON 1/7",
  severity: "high" as const,
  confidence: 0.91,
  scope: {
    type: "pon" as const,
    identifier: "texto devolvido pelo modelo",
    olt: "OLT-2",
    pon: "1/7",
    cto: null,
  },
  affectedCpes: 56,
  summary: "A maioria das CPEs apresenta a mesma degradação.",
  probableCause: "Possível falha no trecho compartilhado.",
  recommendedAction: "Validar a porta e o trecho óptico comum.",
  evidence: [
    {
      source: "telemetry" as const,
      reference: "telemetry_list_daily_metrics:OLT-2/1/7",
      summary: "Erros FEC concentrados na mesma PON.",
    },
  ],
  counterEvidence: [],
  requiresHumanReview: true as const,
};

describe("InvestigationsService.review", () => {
  it("recalcula o escopo antes de criar o agrupamento aprovado", async () => {
    const queries: Array<{ text: string; params: unknown[] }> = [];
    const database = {
      async query(text: string, params: unknown[] = []) {
        queries.push({ text, params });
        if (text.includes("SELECT finding FROM agent_investigations")) {
          return { rows: [{ finding }] };
        }
        return {
          rows: [
            {
              investigation_id: "INV-TESTE123",
              status: "approved",
              incident_id: "INC-TESTE123",
            },
          ],
        };
      },
    } as unknown as DatabaseService;
    let receivedScope: unknown;
    const incidents = {
      async resolveProposedScope(scope: unknown) {
        receivedScope = scope;
        return {
          affected: 62,
          scope: {
            type: "pon",
            identifier: "OLT-2 · PON 1/7",
            olt: "OLT-2",
            pon: "1/7",
            cto: null,
          },
        };
      },
    } as unknown as IncidentsService;
    const agent = {} as OpenAIInvestigationAgent;

    const result = await new InvestigationsService(
      database,
      incidents,
      agent,
    ).review("INV-TESTE123", "approve", "NOC-07", "Evidência validada");

    assert.equal(result.incident_id, "INC-TESTE123");
    assert.deepEqual(receivedScope, finding.scope);
    assert.deepEqual(JSON.parse(String(queries[1].params[4])), {
      type: "pon",
      identifier: "OLT-2 · PON 1/7",
      olt: "OLT-2",
      pon: "1/7",
      cto: null,
    });
    assert.equal(queries[1].params[5], 62);
    assert.match(queries[1].text, /finding->>'confidence'/);
  });
});
