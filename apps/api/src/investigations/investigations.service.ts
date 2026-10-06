import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../database";
import { NetworkService } from "../network/network.service";
import {
  InvestigationAgentError,
  OpenAIInvestigationAgent,
} from "./openai-investigation-agent";
import {
  InvestigationRequest,
  InvestigationStatus,
} from "./investigation.types";

type InvestigationRow = {
  investigation_id: string;
  dedup_key: string;
  trigger_type: string;
  trigger_label: string;
  objective: string;
  scope: Record<string, unknown>;
  status: InvestigationStatus;
  model: string | null;
  openai_response_id: string | null;
  finding: Record<string, unknown> | null;
  tool_trace: Array<Record<string, unknown>>;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  incident_id: string | null;
};

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(minimum, Math.min(maximum, Math.floor(parsed)))
    : fallback;
}

@Injectable()
export class InvestigationsService {
  private readonly running = new Set<string>();
  private readonly maxConcurrency = boundedInteger(
    process.env.AGENT_MAX_CONCURRENCY,
    1,
    1,
    5,
  );

  constructor(
    private readonly database: DatabaseService,
    private readonly network: NetworkService,
    private readonly agent: OpenAIInvestigationAgent,
  ) {}

  config() {
    const runtime = this.agent.runtimeConfig();
    return {
      openaiConfigured: this.agent.configured(),
      model: this.agent.modelName(),
      mcpBaseUrl: process.env.INTERNAL_MCP_BASE_URL ?? "http://127.0.0.1:3000",
      scheduleEnabled: process.env.AGENT_SCHEDULE_ENABLED === "true",
      metricTriggerEnabled: process.env.AGENT_METRIC_TRIGGER_ENABLED === "true",
      metricTriggerIntervalMs: boundedInteger(
        process.env.AGENT_METRIC_TRIGGER_INTERVAL_MS,
        300_000,
        60_000,
        86_400_000,
      ),
      maxConcurrency: this.maxConcurrency,
      reasoningEffort: runtime.reasoningEffort,
      maxContextCharacters: runtime.maxContextCharacters,
      toolCallBudgets: runtime.toolCallBudgets,
      humanApprovalRequired: true,
      writeToolsAvailableToAgent: false,
    };
  }

  async list() {
    const [summary, rows, incidents] = await Promise.all([
      this.database.query<{ status: InvestigationStatus; count: number }>(`
        SELECT status, count(*)::int AS count
        FROM agent_investigations GROUP BY status ORDER BY status`),
      this.database.query<InvestigationRow>(`
        SELECT i.*, o.incident_id
        FROM agent_investigations i
        LEFT JOIN operational_incidents o USING(investigation_id)
        ORDER BY i.created_at DESC
        LIMIT 100`),
      this.database.query<Record<string, unknown>>(`
        SELECT incident_id, investigation_id, status, category, severity, title,
          scope, affected_cpes, confidence, probable_cause, recommended_action,
          evidence, opened_at::text, opened_by, approval_note
        FROM operational_incidents
        ORDER BY opened_at DESC LIMIT 50`),
    ]);
    return {
      config: this.config(),
      summary: Object.fromEntries(
        summary.rows.map(({ status, count }) => [status, count]),
      ),
      investigations: rows.rows,
      incidents: incidents.rows,
    };
  }

  async triggerManual(objective: string) {
    const normalized = objective.trim();
    if (normalized.length < 10 || normalized.length > 600) {
      throw new BadRequestException(
        "Descreva o objetivo da investigação em 10 a 600 caracteres.",
      );
    }
    this.assertConfigured();
    return this.enqueue({
      triggerType: "manual",
      triggerLabel: "Solicitação do operador",
      objective: normalized,
      scope: {},
      dedupKey: `manual:${randomUUID()}`,
    });
  }

  async triggerScheduled() {
    this.assertConfigured();
    const hourBucket = new Date().toISOString().slice(0, 13);
    return this.enqueue({
      triggerType: "schedule",
      triggerLabel: "Revisão recorrente do parque",
      objective:
        "Procure concentrações anormais recentes por PON, firmware, equipamento ou cliente. Confirme o alcance com telemetria e use chamados ou diagnósticos como evidência complementar.",
      scope: { type: "park", window: "latest_available" },
      dedupKey: `schedule:park-health:${hourBucket}`,
    });
  }

  async triggerMetricCandidates() {
    this.assertConfigured();
    const [incidents, latest] = await Promise.all([
      this.network.getIncidents(),
      this.database.query<{ day: string }>(
        "SELECT max(day)::text AS day FROM daily_cpe_metrics",
      ),
    ]);
    const asOf = latest.rows[0]?.day ?? "unknown";
    const queued = [];
    for (const incident of incidents) {
      const existing = await this.findActiveMetricCandidate(incident.id);
      if (existing) {
        queued.push(existing);
        continue;
      }
      queued.push(
        await this.enqueue({
          triggerType: "metric",
          triggerLabel: `Detector: ${incident.title}`,
          objective: `Confirme ou descarte este candidato determinístico: ${incident.title}. Escopo inicial: ${incident.location}. Sinal observado: ${incident.signal}. Verifique alcance, evidências contrárias e ação recomendada.`,
          scope: {
            type: incident.scope,
            sourceIncidentId: incident.id,
            location: incident.location,
            initiallyAffected: incident.affected,
          },
          dedupKey: `metric:${incident.id}:${asOf}`,
        }),
      );
    }
    return { candidates: queued.length, investigations: queued };
  }

  private async findActiveMetricCandidate(
    sourceIncidentId: string,
  ): Promise<InvestigationRow | undefined> {
    const result = await this.database.query<InvestigationRow>(
      `SELECT i.*, o.incident_id
       FROM agent_investigations i
       LEFT JOIN operational_incidents o USING(investigation_id)
       WHERE i.trigger_type='metric'
         AND i.scope->>'sourceIncidentId'=$1
         AND (
           i.status IN ('queued', 'running', 'pending_review')
           OR (i.status='approved' AND o.status <> 'resolved')
         )
       ORDER BY i.created_at DESC
       LIMIT 1`,
      [sourceIncidentId],
    );
    return result.rows[0];
  }

  async retry(investigationId: string) {
    this.assertConfigured();
    const result = await this.database.query<InvestigationRow>(
      `UPDATE agent_investigations
       SET status='queued', openai_response_id=NULL, finding=NULL,
         tool_trace='[]'::jsonb, error=NULL, started_at=NULL, completed_at=NULL
       WHERE investigation_id=$1 AND status='failed'
       RETURNING *, NULL::text AS incident_id`,
      [investigationId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException(
        "Investigação não encontrada ou não está com falha.",
      );
    }
    void this.drainQueue();
    return result.rows[0];
  }

  async review(
    investigationId: string,
    decision: "approve" | "reject",
    reviewer: string,
    note: string,
  ) {
    const normalizedReviewer = reviewer.trim();
    if (normalizedReviewer.length < 2 || normalizedReviewer.length > 100) {
      throw new BadRequestException("Informe o responsável pela revisão.");
    }
    if (note.length > 1_000) {
      throw new BadRequestException(
        "A observação deve ter até 1.000 caracteres.",
      );
    }

    if (decision === "reject") {
      const result = await this.database.query<InvestigationRow>(
        `UPDATE agent_investigations
         SET status='rejected', reviewed_at=now(), reviewed_by=$2, review_note=$3
         WHERE investigation_id=$1 AND status='pending_review'
         RETURNING *, NULL::text AS incident_id`,
        [investigationId, normalizedReviewer, note.trim()],
      );
      if (!result.rows[0]) this.reviewNotFound();
      return result.rows[0];
    }

    const incidentId = `INC-${randomUUID().slice(0, 8).toUpperCase()}`;
    const result = await this.database.query<InvestigationRow>(
      `WITH approved AS (
         UPDATE agent_investigations
         SET status='approved', reviewed_at=now(), reviewed_by=$2, review_note=$3
         WHERE investigation_id=$1 AND status='pending_review'
         RETURNING *
       ), created AS (
         INSERT INTO operational_incidents(
           incident_id, investigation_id, category, severity, title, scope,
           affected_cpes, confidence, probable_cause, recommended_action,
           evidence, opened_by, approval_note
         )
         SELECT $4, investigation_id, finding->>'category', finding->>'severity',
           finding->>'title', finding->'scope',
           (finding->>'affectedCpes')::int, (finding->>'confidence')::double precision,
           finding->>'probableCause', finding->>'recommendedAction', finding->'evidence',
           $2, $3
         FROM approved
         RETURNING incident_id, investigation_id
       )
       SELECT approved.*, created.incident_id
       FROM approved JOIN created USING(investigation_id)`,
      [investigationId, normalizedReviewer, note.trim(), incidentId],
    );
    if (!result.rows[0]) this.reviewNotFound();
    return result.rows[0];
  }

  async recoverQueued(): Promise<void> {
    if (!this.agent.configured()) return;
    await this.database.query(`
      UPDATE agent_investigations
      SET status='queued', error=NULL
      WHERE status='running' AND started_at < now() - interval '15 minutes'
      `);
    void this.drainQueue();
  }

  private async enqueue(request: InvestigationRequest) {
    const investigationId = `INV-${randomUUID().slice(0, 8).toUpperCase()}`;
    const result = await this.database.query<InvestigationRow>(
      `INSERT INTO agent_investigations(
         investigation_id, dedup_key, trigger_type, trigger_label,
         objective, scope, status, model
       ) VALUES ($1,$2,$3,$4,$5,$6,'queued',$7)
       ON CONFLICT (dedup_key) DO NOTHING
       RETURNING *, NULL::text AS incident_id`,
      [
        investigationId,
        request.dedupKey,
        request.triggerType,
        request.triggerLabel,
        request.objective,
        JSON.stringify(request.scope),
        this.agent.modelName(),
      ],
    );
    if (result.rows[0]) {
      void this.drainQueue();
      return result.rows[0];
    }
    const existing = await this.database.query<InvestigationRow>(
      `SELECT i.*, o.incident_id FROM agent_investigations i
       LEFT JOIN operational_incidents o USING(investigation_id)
       WHERE i.dedup_key=$1`,
      [request.dedupKey],
    );
    return existing.rows[0];
  }

  private async process(investigationId: string): Promise<void> {
    if (
      this.running.has(investigationId) ||
      this.running.size >= this.maxConcurrency
    ) {
      return;
    }
    this.running.add(investigationId);
    try {
      const claimed = await this.database.query<{
        trigger_type: "metric" | "schedule" | "manual";
        trigger_label: string;
        objective: string;
        scope: Record<string, unknown>;
        dedup_key: string;
      }>(
        `UPDATE agent_investigations SET status='running', started_at=now(), error=NULL
         WHERE investigation_id=$1 AND status='queued'
         RETURNING trigger_type, trigger_label, objective, scope, dedup_key`,
        [investigationId],
      );
      const row = claimed.rows[0];
      if (!row) return;
      const analysis = await this.agent.analyze({
        triggerType: row.trigger_type,
        triggerLabel: row.trigger_label,
        objective: row.objective,
        scope: row.scope,
        dedupKey: row.dedup_key,
      });
      const status: InvestigationStatus = analysis.finding.problemDetected
        ? "pending_review"
        : analysis.finding.category === "inconclusive"
          ? "inconclusive"
          : "no_problem";
      await this.database.query(
        `UPDATE agent_investigations
         SET status=$2, model=$3, openai_response_id=$4, finding=$5,
           tool_trace=$6, completed_at=now()
         WHERE investigation_id=$1`,
        [
          investigationId,
          status,
          analysis.model,
          analysis.responseId,
          JSON.stringify(analysis.finding),
          JSON.stringify(analysis.toolTrace),
        ],
      );
    } catch (error) {
      const toolTrace =
        error instanceof InvestigationAgentError ? error.toolTrace : [];
      await this.database.query(
        `UPDATE agent_investigations
         SET status='failed', error=$2, tool_trace=$3, completed_at=now()
         WHERE investigation_id=$1`,
        [
          investigationId,
          error instanceof Error ? error.message : String(error),
          JSON.stringify(toolTrace),
        ],
      );
    } finally {
      this.running.delete(investigationId);
      void this.drainQueue();
    }
  }

  private async drainQueue(): Promise<void> {
    const slots = this.maxConcurrency - this.running.size;
    if (slots <= 0) return;
    const next = await this.database.query<{ investigation_id: string }>(
      `SELECT investigation_id FROM agent_investigations
       WHERE status='queued' ORDER BY created_at LIMIT $1`,
      [slots],
    );
    for (const { investigation_id: investigationId } of next.rows) {
      if (!this.running.has(investigationId))
        void this.process(investigationId);
    }
  }

  private assertConfigured(): void {
    if (!this.agent.configured()) {
      throw new BadRequestException(
        "Integração OpenAI não configurada. Defina OPENAI_API_KEY no backend.",
      );
    }
  }

  private reviewNotFound(): never {
    throw new NotFoundException("Investigação não encontrada ou já revisada.");
  }
}
