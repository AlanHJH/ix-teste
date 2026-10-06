import { Queryable } from "../../../shared/infrastructure/database.js";
import {
  Device,
  DeviceSearch,
  InventoryRepository,
  TopologyQuery,
} from "../domain/inventory-repository.js";

const deviceColumns = `
  i.serial, i.customer_id, i.vendor, i.model, i.hw_revision,
  i.software_version, i.plan_mbps, i.previous_plan_mbps,
  i.plan_since::text, i.customer_since::text, i.customer_status,
  i.cancelled_at::text, i.olt, i.pon_port, i.cto, i.city,
  i.neighborhood, i.installed_at::text, i.status, i.removed_at::text,
  d.drop_id AS logical_drop_id, d.source AS logical_drop_source,
  d.confidence AS logical_drop_confidence`;

export class PostgresInventoryRepository implements InventoryRepository {
  constructor(private readonly database: Queryable) {}

  async search(input: DeviceSearch) {
    const query = input.query.trim();
    const params: unknown[] = [query ? `%${query}%` : ""];
    const conditions = [
      `($1 = '' OR i.serial ILIKE $1 OR i.customer_id ILIKE $1
        OR i.vendor ILIKE $1 OR i.model ILIKE $1 OR i.cto ILIKE $1
        OR i.city ILIKE $1 OR i.neighborhood ILIKE $1)`,
    ];
    this.addFilter(
      conditions,
      params,
      "i.status",
      input.status === "all" ? undefined : input.status,
    );
    this.addFilter(conditions, params, "i.vendor", input.vendor);
    this.addFilter(conditions, params, "i.olt", input.olt?.toUpperCase());
    this.addFilter(conditions, params, "i.pon_port", input.pon);
    this.addFilter(conditions, params, "i.cto", input.cto?.toUpperCase());
    return this.page(conditions, params, input.limit, input.offset);
  }

  async topology(input: TopologyQuery) {
    const params: unknown[] = [];
    const conditions = ["i.status='active'"];
    this.addFilter(conditions, params, "i.olt", input.olt?.toUpperCase());
    this.addFilter(conditions, params, "i.pon_port", input.pon);
    this.addFilter(conditions, params, "i.cto", input.cto?.toUpperCase());
    return this.page(conditions, params, input.limit, input.offset);
  }

  async findBySerial(serial: string): Promise<Device | null> {
    const result = await this.database.query<Device>(
      `SELECT ${deviceColumns}
       FROM inventory i LEFT JOIN generated_logical_drops d USING(serial)
       WHERE i.serial=$1`,
      [serial],
    );
    return result.rows[0] ?? null;
  }

  private addFilter(
    conditions: string[],
    params: unknown[],
    column: string,
    value?: string,
  ): void {
    const normalized = value?.trim();
    if (!normalized) return;
    params.push(normalized);
    conditions.push(`${column}=$${params.length}`);
  }

  private async page(
    conditions: string[],
    params: unknown[],
    limit: number,
    offset: number,
  ) {
    const where = conditions.join(" AND ");
    const limitPosition = params.length + 1;
    const offsetPosition = params.length + 2;
    const [countResult, itemsResult] = await Promise.all([
      this.database.query<{ total: number }>(
        `SELECT count(*)::int AS total FROM inventory i WHERE ${where}`,
        params,
      ),
      this.database.query<Device>(
        `SELECT ${deviceColumns}
         FROM inventory i LEFT JOIN generated_logical_drops d USING(serial)
         WHERE ${where}
         ORDER BY i.customer_id, i.serial
         LIMIT $${limitPosition} OFFSET $${offsetPosition}`,
        [...params, limit, offset],
      ),
    ]);
    return {
      total: countResult.rows[0]?.total ?? 0,
      limit,
      offset,
      items: itemsResult.rows,
    };
  }
}
