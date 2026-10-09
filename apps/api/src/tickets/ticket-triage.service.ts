import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { SQL_EXECUTOR, SqlExecutor } from "../infrastructure/sql-executor";
import { decideTicketTriagePolicy } from "./ticket-triage-policy";
import { TicketTriageAgent } from "./ticket-triage-agent";
import type {
  TicketTriageContext,
  TicketTriageDecision,
  TicketTriageStatus,
  TicketTriageTicketSnapshot,
} from "./ticket-triage.types";

type TicketTriageRow = TicketTriageTicketSnapshot & {
  ai_triage_status: TicketTriageStatus;
};

type TicketTriageRunRow = {
  triage_id: string;
  ticket_id: string;
  status: TicketTriageStatus;
  observed_category: string;
  suggested_category: string | null;
  category_correct: boolean | null;
  confidence: number | null;
  action: string;
  reason: string;
  case_scope: string;
  noc_candidate: boolean;
  noc_reason: string | null;
  evidence: string[];
  input_snapshot: Record<string, unknown>;
  decision: Record<string, unknown> | null;
  model: string | null;
  response_id: string | null;
  action_applied: string;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

type TicketTriageProcessResult = {
  status: "completed" | "needs_review" | "failed";
  triageId?: string;
};

const ticketColumns = `
  t.ticket_id, t.opened_at::text, t.customer_id, t.channel, t.category,
  t.description, t.resolution, t.closed_at::text, t.source, t.opened_by,
  t.related_problem_id, t.noc_status, t.source_payload,
  t.ai_triage_status, equipment.city, equipment.neighborhood,
  equipment.olt, equipment.pon_port AS pon, equipment.cto`;

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
export class TicketTriageService {
  private running = false;

  constructor(
    @Inject(SQL_EXECUTOR) private readonly database: SqlExecutor,
    private readonly agent: TicketTriageAgent,
  ) {}

  isConfigured(): boolean {
    return this.agent.configured();
  }

  config() {
    return {
      openaiConfigured: this.agent.configured(),
      model: this.agent.modelName(),
      scheduleEnabled: process.env.TICKET_TRIAGE_SCHEDULE_ENABLED !== "false",
      intervalMs: boundedInteger(
        process.env.TICKET_TRIAGE_INTERVAL_MS,
        900_000,
        60_000,
        86_400_000,
      ),
      batchSize: boundedInteger(
        process.env.TICKET_TRIAGE_BATCH_SIZE,
        10,
        1,
        100,
      ),
      minConfidence: Number.isFinite(
        Number(process.env.TICKET_TRIAGE_MIN_CONFIDENCE),
      )
        ? Math.max(
            0,
            Math.min(1, Number(process.env.TICKET_TRIAGE_MIN_CONFIDENCE)),
          )
        : 0.9,
      autoClose: process.env.TICKET_TRIAGE_AUTO_CLOSE === "true",
      automaticActions: [
        "corrigir categoria do atendimento N1",
        "encaminhar ticket individual para a fila do NOC",
      ],
      humanReviewActions: [
        "confirmar agrupamento NOC",
        "agendar visita técnica",
        "encerrar atendimento",
      ],
    };
  }

  async runPending(limit = this.config().batchSize) {
    if (this.running) {
      return {
        skipped: true,
        reason: "Uma execução de triagem já está em andamento.",
        selected: 0,
        completed: 0,
        needsReview: 0,
        failed: 0,
      };
    }
    if (!this.agent.configured()) {
      return {
        skipped: true,
        reason: "OPENAI_API_KEY não configurada.",
        selected: 0,
        completed: 0,
        needsReview: 0,
        failed: 0,
      };
    }

    this.running = true;
    try {
      const candidates = await this.database.query<TicketTriageRow>(
        `SELECT ${ticketColumns}
         FROM tickets t
         LEFT JOIN LATERAL (
           SELECT city, neighborhood, olt, pon_port, cto
           FROM inventory
           WHERE customer_id=t.customer_id AND status='active'
           ORDER BY installed_at DESC
           LIMIT 1
         ) equipment ON true
         WHERE t.source='n1'
           AND t.ai_triage_status IN ('unprocessed', 'failed')
         ORDER BY t.opened_at ASC, t.ticket_id ASC
         LIMIT $1`,
        [Math.max(1, Math.min(100, Math.floor(limit)))],
      );
      const summary = {
        skipped: false,
        selected: candidates.rows.length,
        completed: 0,
        needsReview: 0,
        failed: 0,
      };
      for (const candidate of candidates.rows) {
        const result = await this.process(candidate);
        if (result.status === "completed") summary.completed += 1;
        if (result.status === "needs_review") summary.needsReview += 1;
        if (result.status === "failed") summary.failed += 1;
      }
      return summary;
    } finally {
      this.running = false;
    }
  }

  async listRuns(ticketId: string): Promise<TicketTriageRunRow[]> {
    const result = await this.database.query<TicketTriageRunRow>(
      `SELECT triage_id, ticket_id, status, observed_category,
        suggested_category, category_correct, confidence, action, reason,
        case_scope, noc_candidate, noc_reason, evidence, input_snapshot,
        decision, model, response_id, action_applied, error,
        created_at::text, completed_at::text
       FROM ticket_ai_triage_runs
       WHERE ticket_id=$1
       ORDER BY created_at DESC
       LIMIT 20`,
      [ticketId.trim().toUpperCase()],
    );
    return result.rows;
  }

  async retry(ticketId: string) {
    if (this.running) {
      return {
        skipped: true,
        requested: false,
        reason: "Uma execução de triagem já está em andamento.",
        ticketId: ticketId.trim().toUpperCase(),
      };
    }
    if (!this.agent.configured()) {
      return {
        skipped: true,
        requested: false,
        reason: "OPENAI_API_KEY não configurada.",
        ticketId: ticketId.trim().toUpperCase(),
      };
    }
    const normalizedTicketId = ticketId.trim().toUpperCase();
    this.running = true;
    try {
      const candidate = await this.findTicket(normalizedTicketId);
      if (!candidate) {
        throw new NotFoundException(
          `Ticket ${normalizedTicketId} não encontrado.`,
        );
      }
      await this.database.query(
        `UPDATE tickets
         SET ai_triage_status='unprocessed', ai_triage_run_id=NULL,
           ai_triage_category=NULL, ai_triage_confidence=NULL,
           ai_triage_action=NULL,
           ai_triage_reason='Reavaliação solicitada manualmente.',
           ai_triage_review_required=true, ai_triage_at=now()
         WHERE ticket_id=$1`,
        [normalizedTicketId],
      );
      const result = await this.process(candidate, true);
      return {
        skipped: false,
        requested: true,
        ticketId: normalizedTicketId,
        triageId: result.triageId ?? null,
        status: result.status,
        previousRunsPreserved: true,
      };
    } finally {
      this.running = false;
    }
  }

  private async findTicket(ticketId: string): Promise<TicketTriageRow | null> {
    const result = await this.database.query<TicketTriageRow>(
      `SELECT ${ticketColumns}
       FROM tickets t
       LEFT JOIN LATERAL (
         SELECT city, neighborhood, olt, pon_port, cto
         FROM inventory
         WHERE customer_id=t.customer_id
         ORDER BY status='active' DESC, installed_at DESC
         LIMIT 1
       ) equipment ON true
       WHERE t.ticket_id=$1`,
      [ticketId],
    );
    return result.rows[0] ?? null;
  }

  private async process(
    candidate: TicketTriageRow,
    allowHistoricalSource = false,
  ): Promise<TicketTriageProcessResult> {
    const sourceCondition = allowHistoricalSource ? "TRUE" : "t.source='n1'";
    const claimed = await this.database.query<{ ticket_id: string }>(
      `UPDATE tickets t
       SET ai_triage_status='running', ai_triage_at=now()
       WHERE t.ticket_id=$1 AND ${sourceCondition}
         AND t.ai_triage_status IN ('unprocessed', 'failed')
       RETURNING t.ticket_id`,
      [candidate.ticket_id],
    );
    if (!claimed.rows[0]) return { status: "completed" };
    const ticket: TicketTriageRow = {
      ...candidate,
      ai_triage_status: "running",
    };

    const triageId = `TRI-${randomUUID().slice(0, 8).toUpperCase()}`;

    try {
      const context = await this.contextFor(ticket);
      await this.database.query(
        `INSERT INTO ticket_ai_triage_runs(
           triage_id, ticket_id, status, observed_category, action, reason,
           case_scope, noc_candidate, input_snapshot, model
         ) VALUES ($1, $2, 'running', $3, 'review',
           'Análise em andamento.', 'uncertain', false, $4::jsonb, $5)`,
        [
          triageId,
          ticket.ticket_id,
          ticket.category,
          JSON.stringify(context),
          this.agent.modelName(),
        ],
      );
      const analysis = await this.agent.analyze(context);
      const decision = analysis.decision;
      const policy = decideTicketTriagePolicy(
        decision,
        ticket.category,
        ticket.closed_at == null,
      );
      const triageSnapshot = {
        triageId,
        analyzedAt: new Date().toISOString(),
        currentCategory: ticket.category,
        suggestedCategory: decision.suggestedCategory,
        categoryCorrect: decision.categoryCorrect,
        caseScope: decision.caseScope,
        nocCandidate: decision.nocCandidate,
        confidence: decision.confidence,
        action: decision.action,
        actionApplied: policy.actionApplied,
        reason: decision.reason,
        nocReason: decision.nocReason,
        evidence: decision.evidence,
        model: analysis.model,
        responseId: analysis.responseId,
      };
      await this.database.query(
        `UPDATE tickets t
         SET category=CASE WHEN $2::boolean THEN $3 ELSE t.category END,
           resolution=CASE
             WHEN $4::boolean THEN 'Escalado para NOC'
             WHEN $5::boolean THEN 'Resolvido no atendimento'
             ELSE t.resolution END,
           closed_at=CASE
             WHEN $5::boolean THEN now()
             WHEN $4::boolean THEN NULL
             ELSE t.closed_at END,
           noc_status=CASE
             WHEN $4::boolean THEN CASE
               WHEN t.related_problem_id LIKE 'INC-%' THEN 'linked'
               ELSE 'pending' END
             WHEN $5::boolean THEN 'not_applicable'
             ELSE t.noc_status END,
           ai_triage_status=$6,
           ai_triage_run_id=$7,
           ai_triage_category=$3,
           ai_triage_confidence=$8,
           ai_triage_action=$9,
           ai_triage_reason=$10,
           ai_triage_review_required=$11,
           ai_triage_at=now(),
           source_payload=jsonb_set(
             coalesce(t.source_payload, '{}'::jsonb),
             '{ai_triage}', $12::jsonb, true)
         WHERE t.ticket_id=$1`,
        [
          ticket.ticket_id,
          policy.reclassify,
          decision.suggestedCategory,
          policy.escalateNoc,
          policy.close,
          policy.status,
          triageId,
          decision.confidence,
          decision.action,
          decision.reason,
          policy.reviewRequired,
          JSON.stringify(triageSnapshot),
        ],
      );
      await this.database.query(
        `UPDATE ticket_ai_triage_runs
         SET status=$2, suggested_category=$3, category_correct=$4,
           confidence=$5, action=$6, reason=$7, case_scope=$8,
           noc_candidate=$9, noc_reason=$10, evidence=$11::jsonb,
           decision=$12::jsonb, model=$13, response_id=$14,
           action_applied=$15, completed_at=now()
         WHERE triage_id=$1`,
        [
          triageId,
          policy.status,
          decision.suggestedCategory,
          decision.categoryCorrect,
          decision.confidence,
          decision.action,
          decision.reason,
          decision.caseScope,
          decision.nocCandidate,
          decision.nocReason,
          JSON.stringify(decision.evidence),
          JSON.stringify(decision),
          analysis.model,
          analysis.responseId,
          policy.actionApplied,
        ],
      );
      return { status: policy.status, triageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.database.query(
        `UPDATE tickets
         SET ai_triage_status='failed', ai_triage_run_id=$2,
           ai_triage_review_required=true, ai_triage_reason=$3, ai_triage_at=now()
         WHERE ticket_id=$1`,
        [ticket.ticket_id, triageId, message],
      );
      await this.database.query(
        `UPDATE ticket_ai_triage_runs
         SET status='failed', error=$2, completed_at=now()
         WHERE triage_id=$1`,
        [triageId, message],
      );
      return { status: "failed", triageId };
    }
  }

  private async contextFor(
    ticket: TicketTriageTicketSnapshot,
  ): Promise<TicketTriageContext> {
    const [
      equipmentResult,
      metricsResult,
      logsResult,
      diagnosticsResult,
      result,
    ] = await Promise.all([
      this.database.query<{
        serial: string;
        vendor: string;
        model: string;
        hardware: string;
        firmware: string;
        planMbps: number;
        olt: string;
        pon: string;
        cto: string;
        city: string;
        neighborhood: string;
      }>(
        `SELECT serial, vendor, model, hw_revision AS hardware,
            software_version AS firmware, plan_mbps AS "planMbps", olt,
            pon_port AS pon, cto, city, neighborhood
           FROM inventory
           WHERE customer_id=$1 AND status='active'
           ORDER BY installed_at DESC
           LIMIT 1`,
        [ticket.customer_id],
      ),
      this.database.query<Record<string, unknown>>(
        `SELECT day::text, serial, software_version, inform_count,
            mem_min_pct, lan_min_mbps, reboot_count, fec_errors,
            optical_rx_min_dbm, wifi_signal_avg_raw
           FROM daily_cpe_metrics
           WHERE customer_id=$1
           ORDER BY day DESC
           LIMIT 7`,
        [ticket.customer_id],
      ),
      this.database.query<Record<string, unknown>>(
        `SELECT ts::text, serial, event_codes, software_version, uptime_s,
            mem_free_kb, optical_rx_power, pon_fec_uncorrectable,
            lan1_bit_rate, wifi_clients_24g, wifi_clients_5g, wifi_rssi_avg
           FROM informs
           WHERE serial=(SELECT serial FROM inventory
             WHERE customer_id=$1 AND status='active'
             ORDER BY installed_at DESC LIMIT 1)
           ORDER BY ts DESC
           LIMIT 12`,
        [ticket.customer_id],
      ),
      this.database.query<Record<string, unknown>>(
        `SELECT ts::text, state, download_mbps, upload_mbps, test_server
           FROM diagnostics
           WHERE serial=(SELECT serial FROM inventory
             WHERE customer_id=$1 AND status='active'
             ORDER BY installed_at DESC LIMIT 1)
           ORDER BY ts DESC
           LIMIT 5`,
        [ticket.customer_id],
      ),
      this.database.query<TicketTriageContext["recentCustomerTickets"][number]>(
        `SELECT ticket_id, opened_at::text, category, description, resolution,
            related_problem_id
           FROM tickets
           WHERE customer_id=$1 AND ticket_id<>$2
           ORDER BY opened_at DESC
           LIMIT 8`,
        [ticket.customer_id, ticket.ticket_id],
      ),
    ]);
    return {
      ticket: {
        ...ticket,
        source_payload: ticket.source_payload ?? {},
      },
      equipment: equipmentResult.rows[0] ?? null,
      recentMetrics: metricsResult.rows,
      recentLogs: logsResult.rows,
      recentDiagnostics: diagnosticsResult.rows,
      recentCustomerTickets: result.rows,
    };
  }
}
