import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../database";
import type { CreateDataLabJobDto } from "../contracts/input.dto";
import { InvestigationsService } from "../investigations/investigations.service";
import { TicketTriageService } from "../tickets/ticket-triage.service";

export type DataLabScenario =
  | "baseline"
  | "optical"
  | "fec"
  | "firmware"
  | "capacity"
  | "missing-inform"
  | "mixed";

export type DataLabJob = {
  jobId: string;
  scenario: DataLabScenario;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  cpeCount: number;
  days: number;
  informsPerDay: number;
  batchSize: number;
  targetRows: number;
  processedCpes: number;
  generatedRows: number;
  includeTickets: boolean;
  includeDiagnostics: boolean;
  routeTicketsThroughN1: boolean;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

type JobInput = {
  scenario: DataLabScenario;
  cpeCount: number;
  days: number;
  informsPerDay: number;
  batchSize: number;
  includeTickets: boolean;
  includeDiagnostics: boolean;
  routeTicketsThroughN1: boolean;
};

const scenarios: DataLabScenario[] = [
  "baseline",
  "optical",
  "fec",
  "firmware",
  "capacity",
  "missing-inform",
  "mixed",
];

function asJob(row: Record<string, unknown>): DataLabJob {
  return {
    jobId: String(row.job_id),
    scenario: row.scenario as DataLabScenario,
    status: row.status as DataLabJob["status"],
    cpeCount: Number(row.cpe_count),
    days: Number(row.days),
    informsPerDay: Number(row.informs_per_day),
    batchSize: Number(row.batch_size),
    targetRows: Number(row.target_rows),
    processedCpes: Number(row.processed_cpes),
    generatedRows: Number(row.generated_rows),
    includeTickets: Boolean(row.include_tickets),
    includeDiagnostics: Boolean(row.include_diagnostics),
    routeTicketsThroughN1: Boolean(row.route_tickets_through_n1),
    error: row.error ? String(row.error) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    startedAt: row.started_at
      ? new Date(String(row.started_at)).toISOString()
      : null,
    completedAt: row.completed_at
      ? new Date(String(row.completed_at)).toISOString()
      : null,
  };
}

@Injectable()
export class DataLabService {
  private activeJobId: string | null = null;

  constructor(
    private readonly database: DatabaseService,
    private readonly investigations: InvestigationsService,
    private readonly ticketTriage: TicketTriageService,
  ) {}

  async preview(input: CreateDataLabJobDto) {
    const normalized = this.normalizeInput(input);
    const available = await this.database.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM inventory WHERE status='active'",
    );
    const targetRows =
      normalized.cpeCount * normalized.days * normalized.informsPerDay;
    const maxRows = this.maxRows();
    return {
      ...normalized,
      targetRows,
      maxRows,
      activeInventoryCpes: Number(available.rows[0]?.count ?? 0),
      syntheticInventory: normalized.cpeCount,
      accepted: targetRows <= maxRows,
      recommendation:
        targetRows <= 100_000
          ? "Execução rápida para validar o fluxo visual."
          : targetRows <= maxRows
            ? "Execução em lotes; acompanhe o progresso sem recarregar a página."
            : "Reduza CPEs, dias ou Informs por dia para respeitar o limite local.",
    };
  }

  async create(input: CreateDataLabJobDto): Promise<DataLabJob> {
    const normalized = this.normalizeInput(input);
    const targetRows =
      normalized.cpeCount * normalized.days * normalized.informsPerDay;
    if (targetRows > this.maxRows()) {
      throw new BadRequestException(
        `O job produziria ${targetRows} eventos; o limite local é ${this.maxRows()}.`,
      );
    }
    if (this.activeJobId) {
      throw new ConflictException(
        "Já existe um job do Data Lab em execução. Aguarde a conclusão ou remova o job concluído.",
      );
    }

    const jobId = randomUUID();
    const result = await this.database.query(
      `INSERT INTO data_lab_jobs(
         job_id, scenario, status, cpe_count, days, informs_per_day, batch_size,
         target_rows, include_tickets, include_diagnostics,
         route_tickets_through_n1
       ) VALUES ($1,$2,'queued',$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        jobId,
        normalized.scenario,
        normalized.cpeCount,
        normalized.days,
        normalized.informsPerDay,
        normalized.batchSize,
        targetRows,
        normalized.includeTickets,
        normalized.includeDiagnostics,
        normalized.routeTicketsThroughN1,
      ],
    );
    this.activeJobId = jobId;
    void this.run(jobId, normalized)
      .catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        await this.cleanupJobData(jobId);
        await this.database.query(
          `UPDATE data_lab_jobs
         SET status='failed', error=$2, completed_at=now()
         WHERE job_id=$1`,
          [jobId, message],
        );
      })
      .finally(() => {
        if (this.activeJobId === jobId) this.activeJobId = null;
      });
    return asJob(result.rows[0] as Record<string, unknown>);
  }

  async get(jobId: string): Promise<DataLabJob> {
    const result = await this.database.query(
      "SELECT * FROM data_lab_jobs WHERE job_id=$1",
      [jobId],
    );
    if (!result.rows[0])
      throw new NotFoundException("Job do Data Lab não encontrado.");
    return asJob(result.rows[0] as Record<string, unknown>);
  }

  async list(): Promise<{ data: DataLabJob[] }> {
    const result = await this.database.query(
      "SELECT * FROM data_lab_jobs ORDER BY created_at DESC LIMIT 12",
    );
    return {
      data: result.rows.map((row) => asJob(row as Record<string, unknown>)),
    };
  }

  async remove(jobId: string) {
    if (this.activeJobId === jobId) {
      throw new ConflictException(
        "Não é seguro remover um job ainda em execução.",
      );
    }
    await this.get(jobId);
    await this.cleanupJobData(jobId);
    await this.database.query("DELETE FROM data_lab_jobs WHERE job_id=$1", [
      jobId,
    ]);
    return { jobId, status: "removed" as const };
  }

  private async cleanupJobData(jobId: string): Promise<void> {
    const providerId = `data-lab-${jobId}`;
    await this.database.query(
      `DELETE FROM diagnostics d
       USING inventory i
       WHERE d.serial=i.serial AND i.data_lab_job_id=$1`,
      [jobId],
    );
    await this.database.query(
      "DELETE FROM tickets WHERE source_payload->>'dataLabJobId'=$1",
      [jobId],
    );
    await this.database.query("DELETE FROM informs WHERE provider_id=$1", [
      providerId,
    ]);
    await this.database.query(
      "DELETE FROM inventory WHERE data_lab_job_id=$1",
      [jobId],
    );
    await this.database
      .query("REFRESH MATERIALIZED VIEW daily_cpe_metrics")
      .catch(() => undefined);
  }

  private normalizeInput(input: CreateDataLabJobDto): JobInput {
    if (!scenarios.includes(input.scenario as DataLabScenario)) {
      throw new BadRequestException("Cenário do Data Lab inválido.");
    }
    return {
      scenario: input.scenario as DataLabScenario,
      cpeCount: input.cpeCount,
      days: input.days,
      informsPerDay: input.informsPerDay,
      batchSize: input.batchSize,
      includeTickets: input.includeTickets ?? true,
      includeDiagnostics: input.includeDiagnostics ?? true,
      routeTicketsThroughN1: input.routeTicketsThroughN1 ?? true,
    };
  }

  private maxRows() {
    const configured = Number(process.env.DATA_LAB_MAX_ROWS ?? 5_000_000);
    return Number.isFinite(configured) && configured > 0
      ? Math.floor(configured)
      : 5_000_000;
  }

  private async run(jobId: string, input: JobInput): Promise<void> {
    const providerId = `data-lab-${jobId}`;
    const anchor = new Date(Date.now() - (input.days - 1) * 86_400_000);
    await this.database.query(
      "UPDATE data_lab_jobs SET status='running', started_at=now() WHERE job_id=$1",
      [jobId],
    );
    await this.createSyntheticInventory(jobId, input, anchor);

    let lastSerial = "";
    let processedCpes = 0;
    let generatedRows = 0;
    while (true) {
      const batch = await this.database.query<{ serial: string }>(
        `SELECT serial
         FROM inventory
         WHERE data_lab_job_id=$1 AND serial>$2
         ORDER BY serial
         LIMIT $3`,
        [jobId, lastSerial, input.batchSize],
      );
      if (!batch.rows.length) break;
      const serials = batch.rows.map((row) => row.serial);
      const telemetry = await this.generateTelemetry(
        jobId,
        providerId,
        input,
        anchor,
        lastSerial,
      );
      if (input.includeTickets) {
        await this.generateTickets(jobId, input, anchor, lastSerial);
      }
      if (input.includeDiagnostics) {
        await this.generateDiagnostics(jobId, input, anchor, lastSerial);
      }
      processedCpes += serials.length;
      generatedRows += telemetry;
      lastSerial = serials[serials.length - 1];
      await this.database.query(
        `UPDATE data_lab_jobs
         SET processed_cpes=$2, generated_rows=$3
         WHERE job_id=$1`,
        [jobId, processedCpes, generatedRows],
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
    }

    // A refresh completa é deliberadamente feita uma vez por job, nunca por
    // evento. O agregador periódico também poderá repetir a atualização.
    await this.database
      .query("REFRESH MATERIALIZED VIEW daily_cpe_metrics")
      .catch(() => undefined);
    await this.database.query(
      `UPDATE data_lab_jobs
       SET status='completed', processed_cpes=$2, generated_rows=$3, completed_at=now()
       WHERE job_id=$1`,
      [jobId, processedCpes, generatedRows],
    );

    const agentConfig = this.investigations.config();
    if (agentConfig.metricTriggerEnabled && agentConfig.openaiConfigured) {
      await this.investigations
        .triggerMetricCandidates()
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error(
            `[data-lab] job ${jobId} concluído, mas a detecção NOC não foi disparada: ${message}`,
          );
        });
    }
    if (input.routeTicketsThroughN1 && this.ticketTriage.isConfigured()) {
      void this.ticketTriage
        .runPending(Math.min(100, Math.max(10, input.cpeCount)), jobId)
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error(
            `[data-lab] job ${jobId} concluído, mas a triagem N1 não foi disparada: ${message}`,
          );
        });
    }
  }

  private async createSyntheticInventory(
    jobId: string,
    input: JobInput,
    anchor: Date,
  ) {
    await this.database.query(
      `INSERT INTO inventory(
         serial, customer_id, vendor, model, hw_revision, software_version,
         plan_mbps, previous_plan_mbps, plan_since, customer_since,
         customer_status, cancelled_at, olt, pon_port, cto, city,
         neighborhood, installed_at, status, removed_at, data_lab_job_id
       )
       SELECT
         'DL' || replace($1::text,'-','') || lpad(gs::text,7,'0'),
         'DLC' || replace($1::text,'-','') || lpad(gs::text,7,'0'),
         CASE WHEN mod(gs,2)=0 THEN 'Kestrel' ELSE 'Norvik' END,
         CASE WHEN mod(gs,2)=0 THEN 'KX-3000' ELSE 'NV-G1' END,
         CASE WHEN mod(gs,3)=0 THEN 'A' ELSE 'B' END,
         CASE
           WHEN $2::text IN ('firmware','mixed') AND mod(gs,5)<>0 THEN '2.4.1'
           ELSE '2.3.8'
         END,
         CASE WHEN $2::text IN ('capacity','mixed') THEN 500 ELSE 300 END,
         300,
         ($3::date - ((gs % 90)::int)),
         ($3::date - 365),
         'active', NULL,
         'OLT-' || (1 + mod(gs,4)),
         (1 + mod(gs,4))::text || '/' || (1 + mod(gs,16))::text,
         'CTO-' || (1 + mod(gs,4))::text || '-' || (1 + mod(gs,16))::text || '-' || (1 + mod(gs,8))::text,
         CASE WHEN mod(gs,3)=0 THEN 'Joinville' WHEN mod(gs,3)=1 THEN 'Curitiba' ELSE 'São José' END,
         CASE WHEN mod(gs,2)=0 THEN 'Centro' ELSE 'Norte' END,
         ($3::date - 365),
         'active', NULL, $1
       FROM generate_series(1,$4::int) AS gs
       ON CONFLICT (serial) DO NOTHING`,
      [
        jobId,
        input.scenario,
        anchor.toISOString().slice(0, 10),
        input.cpeCount,
      ],
    );
  }

  private async generateTelemetry(
    jobId: string,
    providerId: string,
    input: JobInput,
    anchor: Date,
    lastSerial: string,
  ) {
    const result = await this.database.query(
      `WITH targets AS (
         SELECT serial, vendor, software_version, plan_mbps,
                row_number() OVER (ORDER BY serial)::int AS ordinal
         FROM inventory
         WHERE data_lab_job_id=$1 AND serial>$2
         ORDER BY serial
         LIMIT $3
       ), events AS (
         SELECT t.*, d.day_index, s.slot
         FROM targets t
         CROSS JOIN generate_series(0,$4::int-1) AS d(day_index)
         CROSS JOIN generate_series(0,$5::int-1) AS s(slot)
         WHERE NOT (
           ($6::text='missing-inform' AND mod(t.ordinal+d.day_index+s.slot,5)=0)
           OR ($6::text='mixed' AND mod(t.ordinal+d.day_index+s.slot,11)=0)
         )
       ), prepared AS (
         SELECT e.*,
           $7::timestamptz
             + make_interval(days => (($4::int-1)-e.day_index),
                             secs => (e.slot * floor(86400.0/$5::int))) AS event_time
         FROM events e
       )
       INSERT INTO informs(
         ts, serial, event_codes, software_version, uptime_s, mem_total_kb,
         mem_free_kb, optical_rx_power, optical_tx_power,
         pon_fec_uncorrectable, wan_bytes_rx, wan_bytes_tx, lan1_bit_rate,
         wifi_clients_24g, wifi_clients_5g, wifi_rssi_avg, provider_id,
         event_time, received_at, schema_version, ingestion_key,
         normalization_status, raw_payload
       )
       SELECT
         event_time, serial,
         CASE
           WHEN (
             $6::text='firmware'
             OR ($6::text='mixed' AND mod(ordinal,5)=0)
           ) AND mod(ordinal+day_index+slot,4)=0 THEN 'PERIODIC BOOT'
           ELSE 'PERIODIC'
         END,
         software_version,
         120000 + ordinal * 17 + slot * 900,
         131072,
         CASE
           WHEN $6::text='firmware'
             OR ($6::text='mixed' AND mod(ordinal,5)=0)
             THEN 12000 + mod(ordinal+day_index*97+slot,9000)
           ELSE 42000 + mod(ordinal+slot*31,12000)
         END,
         CASE
           WHEN vendor='Kestrel' AND $6::text='optical' THEN -28500 - mod(ordinal+slot,1800)
           WHEN vendor='Kestrel' AND $6::text='mixed' AND mod(ordinal,5)=0 THEN -28500 - mod(ordinal+slot,1800)
           WHEN vendor='Kestrel' THEN -24000 - mod(ordinal+slot,900)
           ELSE 0.0005
         END,
         CASE WHEN vendor='Kestrel' THEN 2300 + mod(ordinal,300) ELSE 0.001 END,
         CASE
           WHEN $6::text='fec'
             OR ($6::text='mixed' AND mod(ordinal,5)=0)
             THEN 60000 + ordinal * 120 + slot * 800
           ELSE 100 + ordinal * 3 + slot
         END,
         0, 0,
         CASE
           WHEN $6::text='capacity'
             OR ($6::text='mixed' AND mod(ordinal,5)=0)
             THEN 100
           ELSE 1000
         END,
         2 + mod(ordinal,5), 4 + mod(ordinal,7), -68 - mod(ordinal,12),
         $8, event_time, now(), '1.0',
         md5($8 || '|' || serial || '|' || event_time::text || '|' || ordinal || '|' || day_index || '|' || slot),
         'accepted',
         jsonb_build_object('source','data-lab','jobId',$1,'scenario',$6)
       FROM prepared
       ON CONFLICT (provider_id, ingestion_key) DO NOTHING`,
      [
        jobId,
        lastSerial,
        input.batchSize,
        input.days,
        input.informsPerDay,
        input.scenario,
        anchor,
        providerId,
      ],
    );
    return result.rowCount ?? 0;
  }

  private async generateTickets(
    jobId: string,
    input: JobInput,
    anchor: Date,
    lastSerial: string,
  ) {
    await this.database.query(
      `WITH targets AS (
         SELECT serial, customer_id, row_number() OVER (ORDER BY serial)::int AS ordinal
         FROM inventory
         WHERE data_lab_job_id=$1 AND serial>$2
         ORDER BY serial
         LIMIT $3
       )
       INSERT INTO tickets(
         ticket_id, opened_at, customer_id, channel, category, description,
         resolution, closed_at, source, opened_by, source_payload, noc_status
       )
       SELECT
         'DLT-' || upper(replace($1::text,'-','')) || '-' || upper(md5(serial || $4::text)),
         $5::timestamptz + make_interval(hours => ordinal), customer_id,
         'monitoring',
         CASE WHEN $4::text IN ('optical','mixed') THEN 'Medição óptica em campo'
              WHEN $4::text IN ('fec','missing-inform') THEN 'Sem conexão'
              WHEN $4::text IN ('capacity') THEN 'Lentidão'
              ELSE 'Sem conexão' END,
         'Sinal sintético criado pelo Data Lab para validação operacional.',
         CASE WHEN $6::boolean THEN 'Em triagem N1'
              WHEN $4::text IN ('optical','fec','firmware','missing-inform','mixed')
              THEN 'Escalado para NOC' ELSE 'Orientação remota' END,
         NULL,
         CASE WHEN $6::boolean THEN 'n1' ELSE 'dataset' END,
         CASE WHEN $6::boolean THEN 'data-lab' ELSE NULL END,
         jsonb_build_object(
           'source','data-lab',
           'dataLabJobId',$1,
           'scenario',$4,
           'ticketFlow', CASE WHEN $6::boolean THEN 'n1' ELSE 'dataset' END
         ),
         CASE WHEN $6::boolean THEN 'not_applicable'
              WHEN $4::text IN ('optical','fec','firmware','missing-inform','mixed')
              THEN 'pending' ELSE 'not_applicable' END
       FROM targets
       WHERE mod(abs(hashtext(serial)),20)=0
       ON CONFLICT (ticket_id) DO NOTHING`,
      [
        jobId,
        lastSerial,
        input.batchSize,
        input.scenario,
        anchor,
        input.routeTicketsThroughN1,
      ],
    );
  }

  private async generateDiagnostics(
    jobId: string,
    input: JobInput,
    anchor: Date,
    lastSerial: string,
  ) {
    await this.database.query(
      `WITH targets AS (
         SELECT serial, row_number() OVER (ORDER BY serial)::int AS ordinal
         FROM inventory
         WHERE data_lab_job_id=$1 AND serial>$2
         ORDER BY serial
         LIMIT $3
       )
       INSERT INTO diagnostics(
         ts, serial, requested_by, diagnostic, state,
         download_mbps, upload_mbps, test_server
       )
       SELECT
         $4::timestamptz + make_interval(hours => ordinal), serial,
         'data-lab', 'speed_test', 'completed',
         CASE WHEN $5::text IN ('capacity','mixed') THEN 100 ELSE 300 END,
         CASE WHEN $5::text IN ('capacity','mixed') THEN 20 ELSE 80 END,
         'synthetic-lab'
       FROM targets
       WHERE mod(abs(hashtext(serial)),10)=0`,
      [jobId, lastSerial, input.batchSize, anchor, input.scenario],
    );
  }
}
