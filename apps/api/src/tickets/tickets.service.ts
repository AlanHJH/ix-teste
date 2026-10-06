import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../database";

type TicketRow = {
  ticket_id: string;
  opened_at: string;
  customer_id: string;
  channel: string;
  category: string;
  description: string;
  resolution: string;
  closed_at: string | null;
  handling_minutes: number | null;
  source: "dataset" | "n1";
  opened_by: string | null;
  related_problem_id: string | null;
  noc_status:
    "not_applicable" | "pending" | "in_progress" | "linked" | "closed";
  city: string | null;
  neighborhood: string | null;
  olt: string | null;
  pon: string | null;
  cto: string | null;
};

type SummaryRow = {
  total: number;
  technical: number;
  escalated: number;
  visits: number;
  avg_handling_minutes: number | null;
};

type ListInput = {
  query: string;
  page: number;
  limit: number;
  category: string;
  resolution: string;
  channel: string;
};

type CreateInput = {
  customerId: string;
  openedBy: string;
  category: string;
  description: string;
  outcome: "resolver_telefone" | "escalar_noc" | "agendar_visita";
  relatedProblemId: string | null;
};

const categories = new Set(["Lentidão", "Sem conexão", "Wi-Fi"]);
const problemIds = new Set([
  "pon-olt2-ja",
  "firmware-kestrel-241",
  "capacity-norvik-a",
  "optical-isolated",
]);
const outcomeResolution = {
  resolver_telefone: "Resolvido no atendimento",
  escalar_noc: "Escalado para NOC",
  agendar_visita: "Visita técnica agendada",
} as const;

@Injectable()
export class TicketsService {
  constructor(private readonly database: DatabaseService) {}

  async create(input: CreateInput) {
    const customerId = input.customerId.trim().toUpperCase();
    const openedBy = input.openedBy.trim();
    const description = input.description.trim();
    if (openedBy.length < 2 || openedBy.length > 100) {
      throw new BadRequestException("Informe o responsável pelo atendimento.");
    }
    if (!categories.has(input.category)) {
      throw new BadRequestException("Selecione uma categoria técnica válida.");
    }
    if (description.length < 10 || description.length > 600) {
      throw new BadRequestException(
        "Descreva o relato do cliente em 10 a 600 caracteres.",
      );
    }
    if (!Object.hasOwn(outcomeResolution, input.outcome)) {
      throw new BadRequestException("Selecione um encaminhamento válido.");
    }
    const isIncidentId = /^INC-[A-F0-9]{8}$/.test(input.relatedProblemId ?? "");
    if (
      input.relatedProblemId &&
      !problemIds.has(input.relatedProblemId) &&
      !isIncidentId
    ) {
      throw new BadRequestException("Problema relacionado inválido.");
    }

    if (input.relatedProblemId && isIncidentId) {
      const incident = await this.database.query<{ incident_id: string }>(
        `SELECT incident_id FROM operational_incidents
         WHERE incident_id=$1 AND status IN ('open', 'mitigating', 'monitoring')`,
        [input.relatedProblemId],
      );
      if (!incident.rows[0]) {
        throw new BadRequestException("Incidente relacionado não está ativo.");
      }
    }

    if (input.relatedProblemId && problemIds.has(input.relatedProblemId)) {
      const resolvedGrouping = await this.database.query<{
        grouping_id: string;
      }>(
        `SELECT grouping_id FROM detected_group_states
         WHERE grouping_id=$1 AND status='resolved'`,
        [input.relatedProblemId],
      );
      if (resolvedGrouping.rows[0]) {
        throw new BadRequestException(
          "Agrupamento relacionado não está ativo.",
        );
      }
    }

    const customer = await this.database.query<{ customer_id: string }>(
      `SELECT customer_id FROM inventory
       WHERE customer_id=$1 AND status='active' LIMIT 1`,
      [customerId],
    );
    if (!customer.rows[0]) {
      throw new NotFoundException("Cliente ativo não encontrado.");
    }

    const ticketId = `TN1-${randomUUID().slice(0, 8).toUpperCase()}`;
    const resolution = outcomeResolution[input.outcome];
    const result = await this.database.query<TicketRow>(
      `INSERT INTO tickets(
         ticket_id, opened_at, customer_id, channel, category, description,
         resolution, closed_at, source, opened_by, related_problem_id, noc_status
       ) VALUES (
         $1, now(), $2, 'Telefone', $3, $4, $5,
         CASE WHEN $6='resolver_telefone' THEN now() ELSE NULL END,
         'n1', $7, $8,
         CASE WHEN $6='escalar_noc' THEN 'pending' ELSE 'not_applicable' END
       )
       RETURNING ticket_id, opened_at::text, customer_id, channel, category,
         description, resolution, closed_at::text,
         CASE WHEN closed_at IS NULL THEN NULL
           ELSE round(extract(epoch FROM (closed_at-opened_at))/60)::int END AS handling_minutes,
         source, opened_by, related_problem_id, noc_status,
         NULL::text AS city, NULL::text AS neighborhood, NULL::text AS olt,
         NULL::text AS pon, NULL::text AS cto`,
      [
        ticketId,
        customerId,
        input.category,
        description,
        resolution,
        input.outcome,
        openedBy,
        input.relatedProblemId,
      ],
    );
    return result.rows[0];
  }

  async nocQueue() {
    const result = await this.database.query<TicketRow>(`
      SELECT t.ticket_id, t.opened_at::text, t.customer_id, t.channel,
        t.category, t.description, t.resolution, t.closed_at::text,
        NULL::int AS handling_minutes, t.source, t.opened_by,
        t.related_problem_id, t.noc_status,
        equipment.city, equipment.neighborhood, equipment.olt,
        equipment.pon_port AS pon, equipment.cto
      FROM tickets t
      LEFT JOIN LATERAL (
        SELECT city, neighborhood, olt, pon_port, cto
        FROM inventory
        WHERE customer_id=t.customer_id AND status='active'
        ORDER BY installed_at DESC
        LIMIT 1
      ) equipment ON true
      WHERE t.source='n1'
        AND t.resolution='Escalado para NOC'
        AND t.noc_status IN ('pending', 'in_progress')
      ORDER BY t.opened_at ASC, t.ticket_id ASC
      LIMIT 100`);
    return {
      total: result.rows.length,
      summary: {
        received: result.rows.filter(
          (ticket) => ticket.noc_status === "pending",
        ).length,
        inProgress: result.rows.filter(
          (ticket) => ticket.noc_status === "in_progress",
        ).length,
      },
      items: result.rows,
    };
  }

  async updateNocStatus(ticketId: string, status: "in_progress" | "closed") {
    if (!new Set(["in_progress", "closed"]).has(status)) {
      throw new BadRequestException("Movimentação do Kanban inválida.");
    }
    const closing = status === "closed";
    const result = await this.database.query<TicketRow>(
      `UPDATE tickets
       SET noc_status=$2,
         closed_at=CASE WHEN $2='closed' THEN coalesce(closed_at, now())
           ELSE closed_at END
       WHERE ticket_id=$1 AND source='n1'
         AND resolution='Escalado para NOC'
         AND noc_status=${closing ? "'in_progress'" : "'pending'"}
       RETURNING ticket_id, opened_at::text, customer_id, channel, category,
         description, resolution, closed_at::text,
         NULL::int AS handling_minutes, source, opened_by,
         related_problem_id, noc_status,
         NULL::text AS city, NULL::text AS neighborhood,
         NULL::text AS olt, NULL::text AS pon, NULL::text AS cto`,
      [ticketId.trim().toUpperCase(), status],
    );
    if (!result.rows[0]) {
      throw new NotFoundException(
        closing
          ? "Chamado não encontrado ou já saiu da coluna em andamento."
          : "Chamado não encontrado ou já saiu da coluna de recebidos.",
      );
    }
    return result.rows[0];
  }

  async list(input: ListInput) {
    const query = input.query.trim();
    const category = input.category === "all" ? "" : input.category;
    const resolution = input.resolution === "all" ? "" : input.resolution;
    const channel = input.channel === "all" ? "" : input.channel;
    const search = query ? `%${query}%` : "";
    const params = [search, category, resolution, channel];
    const where = `
      ($1 = '' OR t.ticket_id ILIKE $1 OR t.customer_id ILIKE $1
        OR t.description ILIKE $1 OR t.resolution ILIKE $1)
      AND ($2 = '' OR t.category = $2)
      AND ($3 = '' OR t.resolution = $3)
      AND ($4 = '' OR t.channel = $4)`;
    const offset = (input.page - 1) * input.limit;

    const [summaryResult, itemsResult, optionsResult] = await Promise.all([
      this.database.query<SummaryRow>(
        `
          SELECT
            count(*)::int AS total,
            count(*) FILTER (WHERE t.category IN ('Lentidão', 'Sem conexão', 'Wi-Fi'))::int AS technical,
            count(*) FILTER (WHERE t.resolution = 'Escalado para NOC')::int AS escalated,
            count(*) FILTER (WHERE t.resolution = 'Visita técnica agendada')::int AS visits,
            round(avg(extract(epoch FROM (t.closed_at - t.opened_at)) / 60)::numeric, 1) AS avg_handling_minutes
          FROM tickets t
          WHERE ${where}`,
        params,
      ),
      this.database.query<TicketRow>(
        `
          SELECT t.ticket_id, t.opened_at::text, t.customer_id, t.channel,
            t.category, t.description, t.resolution, t.closed_at::text,
            round(extract(epoch FROM (t.closed_at - t.opened_at)) / 60)::int AS handling_minutes,
            t.source, t.opened_by, t.related_problem_id, t.noc_status,
            equipment.city, equipment.neighborhood, equipment.olt,
            equipment.pon_port AS pon, equipment.cto
          FROM tickets t
          LEFT JOIN LATERAL (
            SELECT city, neighborhood, olt, pon_port, cto
            FROM inventory
            WHERE customer_id = t.customer_id AND status = 'active'
            ORDER BY installed_at DESC
            LIMIT 1
          ) equipment ON true
          WHERE ${where}
          ORDER BY t.opened_at DESC, t.ticket_id DESC
          LIMIT $5 OFFSET $6`,
        [...params, input.limit, offset],
      ),
      this.database.query<{
        categories: string[];
        resolutions: string[];
        channels: string[];
      }>(`
        SELECT
          ARRAY(SELECT DISTINCT category FROM tickets ORDER BY category) AS categories,
          ARRAY(SELECT DISTINCT resolution FROM tickets ORDER BY resolution) AS resolutions,
          ARRAY(SELECT DISTINCT channel FROM tickets ORDER BY channel) AS channels`),
    ]);

    return {
      page: input.page,
      limit: input.limit,
      total: summaryResult.rows[0].total,
      summary: summaryResult.rows[0],
      items: itemsResult.rows,
      filters: optionsResult.rows[0],
    };
  }
}
