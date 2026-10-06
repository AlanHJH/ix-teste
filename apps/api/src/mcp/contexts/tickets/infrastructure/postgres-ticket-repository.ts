import { Queryable } from "../../../shared/infrastructure/database.js";
import { TicketQuery, TicketRepository } from "../domain/ticket-repository.js";

const ticketColumns = `
  t.ticket_id, t.opened_at::text, t.customer_id, t.channel, t.category,
  t.description, t.resolution, t.closed_at::text,
  round(extract(epoch FROM (t.closed_at - t.opened_at)) / 60)::int AS handling_minutes,
  equipment.serial, equipment.olt, equipment.pon_port, equipment.cto,
  equipment.city, equipment.neighborhood`;

const inventoryJoin = `
  LEFT JOIN LATERAL (
    SELECT serial, olt, pon_port, cto, city, neighborhood
    FROM inventory
    WHERE customer_id=t.customer_id
    ORDER BY status='active' DESC, installed_at DESC
    LIMIT 1
  ) equipment ON true`;

export class PostgresTicketRepository implements TicketRepository {
  constructor(private readonly database: Queryable) {}

  async list(input: TicketQuery) {
    const params: unknown[] = [];
    const conditions: string[] = [];
    const query = input.query.trim();
    if (query) {
      params.push(`%${query}%`);
      conditions.push(`(t.ticket_id ILIKE $${params.length}
        OR t.customer_id ILIKE $${params.length}
        OR t.description ILIKE $${params.length}
        OR t.resolution ILIKE $${params.length})`);
    }
    this.filter(conditions, params, "t.customer_id", input.customerId);
    this.filter(conditions, params, "t.category", input.category);
    this.filter(conditions, params, "t.resolution", input.resolution);
    this.filter(conditions, params, "t.channel", input.channel);
    this.filter(conditions, params, "t.opened_at", input.from, ">=");
    this.filter(conditions, params, "t.opened_at", input.to, "<=");
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const limitPosition = params.length + 1;
    const offsetPosition = params.length + 2;
    const [countResult, itemsResult] = await Promise.all([
      this.database.query<{ total: number }>(
        `SELECT count(*)::int AS total FROM tickets t ${where}`,
        params,
      ),
      this.database.query<Record<string, unknown>>(
        `SELECT ${ticketColumns}
         FROM tickets t ${inventoryJoin}
         ${where}
         ORDER BY t.opened_at DESC, t.ticket_id
         LIMIT $${limitPosition} OFFSET $${offsetPosition}`,
        [...params, input.limit, input.offset],
      ),
    ]);
    return {
      total: countResult.rows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
      items: itemsResult.rows,
    };
  }

  async findById(ticketId: string) {
    const result = await this.database.query<Record<string, unknown>>(
      `SELECT ${ticketColumns}
       FROM tickets t ${inventoryJoin}
       WHERE t.ticket_id=$1`,
      [ticketId],
    );
    return result.rows[0] ?? null;
  }

  private filter(
    conditions: string[],
    params: unknown[],
    column: string,
    value?: string,
    operator = "=",
  ): void {
    const normalized = value?.trim();
    if (!normalized) return;
    params.push(normalized);
    conditions.push(`${column} ${operator} $${params.length}`);
  }
}
