import { DatabaseService } from "../../database";
import {
  TicketFilterKind,
  TicketFilterOption,
  TicketListQuery,
  TicketListResult,
  TicketNocQueueResult,
  TicketNocStatus,
  TicketRow,
  TicketSummary,
  PersistTicketCommand,
} from "../domain/ticket";
import { TicketsRepository } from "../application/ticket-repository";

type SummaryRow = TicketSummary;

export class PostgresTicketsRepository implements TicketsRepository {
  constructor(private readonly database: DatabaseService) {}

  async hasActiveOperationalIncident(incidentId: string): Promise<boolean> {
    const result = await this.database.query<{ incident_id: string }>(
      `SELECT incident_id FROM operational_incidents
       WHERE incident_id=$1 AND status IN ('open', 'mitigating', 'monitoring')`,
      [incidentId],
    );
    return Boolean(result.rows[0]);
  }

  async hasResolvedDetectedGrouping(groupingId: string): Promise<boolean> {
    const result = await this.database.query<{ grouping_id: string }>(
      `SELECT grouping_id FROM detected_group_states
       WHERE grouping_id=$1 AND status='resolved'`,
      [groupingId],
    );
    return Boolean(result.rows[0]);
  }

  async hasActiveCustomer(customerId: string): Promise<boolean> {
    const result = await this.database.query<{ customer_id: string }>(
      `SELECT customer_id FROM inventory
       WHERE customer_id=$1 AND status='active' LIMIT 1`,
      [customerId],
    );
    return Boolean(result.rows[0]);
  }

  async create(input: PersistTicketCommand): Promise<TicketRow> {
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
        input.ticketId,
        input.customerId,
        input.category,
        input.description,
        input.resolution,
        input.outcome,
        input.openedBy,
        input.relatedProblemId,
      ],
    );
    return result.rows[0];
  }

  async listNocQueue(
    page: number,
    pageSize: number,
    sort: string,
  ): Promise<TicketNocQueueResult> {
    const orderBy =
      sort === "opened_at_desc"
        ? "t.opened_at DESC, t.ticket_id ASC"
        : sort === "status_asc"
          ? "t.noc_status ASC, t.opened_at ASC, t.ticket_id ASC"
          : "t.opened_at ASC, t.ticket_id ASC";
    const [summaryResult, result] = await Promise.all([
      this.database.query<{
        total: number;
        received: number;
        in_progress: number;
      }>(`
        SELECT count(*)::int AS total,
          count(*) FILTER (WHERE noc_status='pending')::int AS received,
          count(*) FILTER (WHERE noc_status='in_progress')::int AS in_progress
        FROM tickets
        WHERE source='n1' AND resolution='Escalado para NOC'
          AND noc_status IN ('pending', 'in_progress')`),
      this.database.query<TicketRow>(
        `
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
      ORDER BY ${orderBy}
      LIMIT $1 OFFSET $2`,
        [pageSize, (page - 1) * pageSize],
      ),
    ]);
    const summary = summaryResult.rows[0];
    return {
      rows: result.rows,
      total: summary.total,
      received: summary.received,
      inProgress: summary.in_progress,
    };
  }

  async get(ticketId: string): Promise<TicketRow | null> {
    const result = await this.database.query<TicketRow>(
      `SELECT t.ticket_id, t.opened_at::text, t.customer_id, t.channel,
        t.category, t.description, t.resolution, t.closed_at::text,
        round(extract(epoch FROM (t.closed_at - t.opened_at)) / 60)::int AS handling_minutes,
        t.source, t.opened_by, t.related_problem_id, t.noc_status,
        equipment.city, equipment.neighborhood, equipment.olt,
        equipment.pon_port AS pon, equipment.cto
       FROM tickets t
       LEFT JOIN LATERAL (
         SELECT city, neighborhood, olt, pon_port, cto
         FROM inventory WHERE customer_id=t.customer_id
         ORDER BY status='active' DESC, installed_at DESC LIMIT 1
       ) equipment ON true
       WHERE t.ticket_id=$1`,
      [ticketId],
    );
    return result.rows[0] ?? null;
  }

  async updateNocStatus(
    ticketId: string,
    status: Extract<TicketNocStatus, "in_progress" | "closed">,
  ): Promise<TicketRow | null> {
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
      [ticketId, status],
    );
    return result.rows[0] ?? null;
  }

  async list(input: TicketListQuery): Promise<TicketListResult> {
    const query = input.query.trim();
    const category = input.category === "all" ? "" : input.category;
    const resolution = input.resolution === "all" ? "" : input.resolution;
    const channel = input.channel === "all" ? "" : input.channel;
    const customerId = input.customerId.trim();
    const from = input.from.trim();
    const to = input.to.trim();
    const search = query ? `%${query}%` : "";
    const params: unknown[] = [
      search,
      category,
      resolution,
      channel,
      customerId,
      from,
      to,
    ];
    const conditions = [
      `
      ($1 = '' OR t.ticket_id ILIKE $1 OR t.customer_id ILIKE $1
        OR t.description ILIKE $1 OR t.resolution ILIKE $1)
      AND ($2 = '' OR t.category = $2)
      AND ($3 = '' OR t.resolution = $3)
      AND ($4 = '' OR t.channel = $4)
      AND ($5 = '' OR t.customer_id = $5)
      AND ($6 = '' OR t.opened_at >= NULLIF($6, '')::timestamptz)
      AND ($7 = '' OR t.opened_at < CASE
        WHEN $7 ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          THEN NULLIF($7, '')::date + INTERVAL '1 day'
        ELSE NULLIF($7, '')::timestamptz + INTERVAL '1 microsecond'
      END)`,
    ];
    const columns: Record<TicketFilterKind, string> = {
      ticket: "t.ticket_id",
      customer: "t.customer_id",
      category: "t.category",
      resolution: "t.resolution",
      channel: "t.channel",
      nocStatus: "t.noc_status",
      source: "t.source",
      openedBy: "t.opened_by",
      olt: "equipment.olt",
      pon: "equipment.pon_port",
      cto: "equipment.cto",
    };
    const groupedFilters = new Map<TicketFilterKind, string[]>();
    for (const filter of input.filters) {
      groupedFilters.set(filter.kind, [
        ...(groupedFilters.get(filter.kind) ?? []),
        filter.value,
      ]);
    }
    for (const [kind, values] of groupedFilters) {
      params.push(values);
      conditions.push(`${columns[kind]} = ANY($${params.length}::text[])`);
    }
    const where = conditions.join(" AND ");
    const offset = (input.page - 1) * input.pageSize;
    const orderBy: Record<string, string> = {
      opened_at_desc: "t.opened_at DESC, t.ticket_id DESC",
      opened_at_asc: "t.opened_at ASC, t.ticket_id ASC",
      customer_id_asc: "t.customer_id ASC, t.opened_at DESC",
      customer_id_desc: "t.customer_id DESC, t.opened_at DESC",
      category_asc: "t.category ASC, t.opened_at DESC, t.ticket_id ASC",
      category_desc: "t.category DESC, t.opened_at DESC, t.ticket_id ASC",
      resolution_asc: "t.resolution ASC, t.opened_at DESC, t.ticket_id ASC",
      resolution_desc: "t.resolution DESC, t.opened_at DESC, t.ticket_id ASC",
      handling_minutes_desc:
        "coalesce(t.closed_at, now()) - t.opened_at DESC, t.ticket_id DESC",
      handling_minutes_asc:
        "coalesce(t.closed_at, now()) - t.opened_at ASC, t.ticket_id ASC",
      noc_priority_desc:
        "CASE t.noc_status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, t.opened_at ASC, t.ticket_id ASC",
    };

    const inventoryJoin = `
      LEFT JOIN LATERAL (
        SELECT city, neighborhood, olt, pon_port, cto
        FROM inventory
        WHERE customer_id = t.customer_id AND status = 'active'
        ORDER BY installed_at DESC
        LIMIT 1
      ) equipment ON true`;

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
          ${inventoryJoin}
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
          ${inventoryJoin}
          WHERE ${where}
          ORDER BY ${orderBy[input.sort] ?? orderBy.opened_at_desc}
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, input.pageSize, offset],
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
      rows: itemsResult.rows,
      summary: summaryResult.rows[0],
      filters: optionsResult.rows[0],
    };
  }

  async filterOptions(
    query: string,
    page: number,
    pageSize: number,
    sort: string,
    kind: TicketFilterKind | "",
  ): Promise<{ rows: TicketFilterOption[]; totalItems: number }> {
    const search = query.trim().slice(0, 120);
    const result = await this.database.query<
      TicketFilterOption & { total_items: number }
    >(
      `WITH base AS (
         SELECT t.ticket_id, t.customer_id, t.category, t.resolution, t.channel,
           t.noc_status, t.source, t.opened_by, equipment.olt,
           equipment.pon_port AS pon, equipment.cto
         FROM tickets t
         LEFT JOIN LATERAL (
           SELECT olt, pon_port, cto
           FROM inventory
           WHERE customer_id = t.customer_id AND status = 'active'
           ORDER BY installed_at DESC
           LIMIT 1
         ) equipment ON true
       ), options AS (
         SELECT 'ticket'::text AS kind, ticket_id::text AS value,
           ticket_id::text AS label, min(category)::text AS detail,
           count(*)::int AS count FROM base GROUP BY ticket_id
         UNION ALL
         SELECT 'customer', customer_id, customer_id, 'Cliente', count(*)::int
           FROM base GROUP BY customer_id
         UNION ALL
         SELECT 'category', category, category, 'Categoria', count(*)::int
           FROM base GROUP BY category
         UNION ALL
         SELECT 'resolution', resolution, resolution, 'Resolução', count(*)::int
           FROM base GROUP BY resolution
         UNION ALL
         SELECT 'channel', channel, channel, 'Canal', count(*)::int
           FROM base GROUP BY channel
         UNION ALL
         SELECT 'nocStatus', noc_status,
           CASE noc_status
             WHEN 'pending' THEN 'Aguardando NOC'
             WHEN 'in_progress' THEN 'Em análise pelo NOC'
             WHEN 'linked' THEN 'Vinculado a agrupamento'
             WHEN 'closed' THEN 'Encerrado pelo NOC'
             ELSE 'Sem atribuição ao NOC' END,
           'Situação NOC', count(*)::int FROM base GROUP BY noc_status
         UNION ALL
         SELECT 'source', source,
           CASE source WHEN 'n1' THEN 'Aberto pelo N1' ELSE 'Histórico importado' END,
           'Origem', count(*)::int FROM base GROUP BY source
         UNION ALL
         SELECT 'openedBy', opened_by, opened_by, 'Responsável pela abertura', count(*)::int
           FROM base WHERE opened_by IS NOT NULL GROUP BY opened_by
         UNION ALL
         SELECT 'olt', olt, olt, 'OLT', count(*)::int
           FROM base WHERE olt IS NOT NULL GROUP BY olt
         UNION ALL
         SELECT 'pon', pon, pon, 'Porta PON', count(*)::int
           FROM base WHERE pon IS NOT NULL GROUP BY pon
         UNION ALL
         SELECT 'cto', cto, cto, 'CTO', count(*)::int
           FROM base WHERE cto IS NOT NULL GROUP BY cto
       )
       SELECT kind, value, label, detail, count,
         count(*) OVER()::int AS total_items
       FROM options
       WHERE (($1 = '' AND kind IN ('nocStatus', 'source', 'category', 'resolution', 'channel', 'olt'))
          OR ($1 <> '' AND (value ILIKE $1 OR label ILIKE $1 OR detail ILIKE $1)))
         AND ($4 = '' OR kind = $4)
       ORDER BY ${
         sort === "label_desc"
           ? "label DESC, kind ASC"
           : sort === "label_asc"
             ? "label ASC, kind ASC"
             : `CASE
                 WHEN lower(label) = lower(trim(both '%' from $1)) THEN 0
                 WHEN lower(label) LIKE lower(trim(both '%' from $1)) || '%' THEN 1
                 WHEN label ILIKE $1 THEN 2
                 ELSE 3 END,
               CASE kind
                 WHEN 'nocStatus' THEN 0 WHEN 'source' THEN 1
                 WHEN 'category' THEN 2 WHEN 'resolution' THEN 3
                 WHEN 'channel' THEN 4 WHEN 'olt' THEN 5
                 WHEN 'pon' THEN 6 WHEN 'cto' THEN 7
                 WHEN 'customer' THEN 8 ELSE 9 END,
               count DESC, label ASC`
       }
       LIMIT $2 OFFSET $3`,
      [search ? `%${search}%` : "", pageSize, (page - 1) * pageSize, kind],
    );
    return {
      rows: result.rows.map(({ total_items: _totalItems, ...row }) => row),
      totalItems: result.rows[0]?.total_items ?? 0,
    };
  }
}
