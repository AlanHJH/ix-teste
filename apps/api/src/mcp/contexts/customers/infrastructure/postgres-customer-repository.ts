import { Queryable } from "../../../shared/infrastructure/database.js";
import {
  CustomerDetails,
  CustomerRepository,
  CustomerSearch,
  CustomerSummary,
} from "../domain/customer-repository.js";

export class PostgresCustomerRepository implements CustomerRepository {
  constructor(private readonly database: Queryable) {}

  async search(input: CustomerSearch) {
    const query = input.query.trim();
    const search = query ? `%${query}%` : "";
    const status = input.status === "all" ? "" : input.status;
    const where = `
      ($1 = '' OR customer_id ILIKE $1 OR serial ILIKE $1 OR city ILIKE $1
        OR neighborhood ILIKE $1)
      AND ($2 = '' OR customer_status = $2)`;

    const [countResult, itemsResult] = await Promise.all([
      this.database.query<{ total: number }>(
        `SELECT count(DISTINCT customer_id)::int AS total FROM inventory WHERE ${where}`,
        [search, status],
      ),
      this.database.query<CustomerSummary>(
        `
        SELECT DISTINCT ON (customer_id)
          customer_id, customer_status, customer_since::text,
          cancelled_at::text, CASE WHEN status='active' THEN serial END AS active_serial,
          city, neighborhood, plan_mbps
        FROM inventory
        WHERE ${where}
        ORDER BY customer_id, status='active' DESC, installed_at DESC
        LIMIT $3 OFFSET $4`,
        [search, status, input.limit, input.offset],
      ),
    ]);

    return {
      total: countResult.rows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
      items: itemsResult.rows,
    };
  }

  async findById(customerId: string): Promise<CustomerDetails | null> {
    const result = await this.database.query<{
      customer_id: string;
      customer_status: string;
      customer_since: string;
      cancelled_at: string | null;
      serial: string;
      vendor: string;
      model: string;
      hw_revision: string;
      software_version: string;
      plan_mbps: number;
      previous_plan_mbps: number | null;
      plan_since: string;
      olt: string;
      pon_port: string;
      cto: string;
      city: string;
      neighborhood: string;
      installed_at: string;
      status: string;
      removed_at: string | null;
    }>(
      `
      SELECT customer_id, customer_status, customer_since::text, cancelled_at::text,
        serial, vendor, model, hw_revision, software_version, plan_mbps,
        previous_plan_mbps, plan_since::text, olt, pon_port, cto, city,
        neighborhood, installed_at::text, status, removed_at::text
      FROM inventory
      WHERE customer_id=$1
      ORDER BY status='active' DESC, installed_at DESC`,
      [customerId],
    );
    if (result.rows.length === 0) return null;
    const first = result.rows[0];
    return {
      customer: {
        customer_id: first.customer_id,
        customer_status: first.customer_status,
        customer_since: first.customer_since,
        cancelled_at: first.cancelled_at,
      },
      equipment_history: result.rows.map(
        ({
          customer_id,
          customer_status,
          customer_since,
          cancelled_at,
          ...row
        }) => row,
      ),
    };
  }
}
