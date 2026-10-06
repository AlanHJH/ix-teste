import { Queryable } from "../../../shared/infrastructure/database.js";
import {
  DailyMetricQuery,
  InformQuery,
  TelemetryRepository,
} from "../domain/telemetry-repository.js";

export class PostgresTelemetryRepository implements TelemetryRepository {
  constructor(private readonly database: Queryable) {}

  async listInforms(input: InformQuery) {
    const params: unknown[] = [input.serial.trim()];
    const conditions = ["serial=$1"];
    this.addFilter(conditions, params, "ts >=", input.from);
    this.addFilter(conditions, params, "ts <=", input.to);
    if (input.eventCode?.trim()) {
      params.push(`%${input.eventCode.trim()}%`);
      conditions.push(`event_codes ILIKE $${params.length}`);
    }
    this.addFilter(
      conditions,
      params,
      "software_version =",
      input.softwareVersion,
    );
    return this.page(
      "informs",
      "*",
      conditions,
      params,
      "ts DESC, serial",
      input.limit,
      input.offset,
    );
  }

  async listDailyMetrics(input: DailyMetricQuery) {
    const params: unknown[] = [];
    const conditions: string[] = [];
    this.addFilter(conditions, params, "serial =", input.serial);
    this.addFilter(conditions, params, "customer_id =", input.customerId);
    this.addFilter(conditions, params, "olt =", input.olt?.toUpperCase());
    this.addFilter(conditions, params, "pon_port =", input.pon);
    this.addFilter(
      conditions,
      params,
      "software_version =",
      input.softwareVersion,
    );
    this.addFilter(conditions, params, "day >=", input.fromDay);
    this.addFilter(conditions, params, "day <=", input.toDay);
    return this.page(
      "daily_cpe_metrics",
      "day::text, serial, customer_id, vendor, model, hw_revision, software_version, plan_mbps, previous_plan_mbps, plan_since::text, olt, pon_port, cto, city, neighborhood, inform_count, mem_min_pct, mem_avg_pct, lan_min_mbps, lan_max_mbps, reboot_count, fec_errors, optical_rx_min_dbm, optical_rx_avg_dbm, wifi_signal_avg_raw",
      conditions,
      params,
      "day DESC, serial, software_version",
      input.limit,
      input.offset,
    );
  }

  private addFilter(
    conditions: string[],
    params: unknown[],
    expression: string,
    value?: string,
  ): void {
    const normalized = value?.trim();
    if (!normalized) return;
    params.push(normalized);
    conditions.push(`${expression} $${params.length}`);
  }

  private async page(
    table: string,
    columns: string,
    conditions: string[],
    params: unknown[],
    orderBy: string,
    limit: number,
    offset: number,
  ) {
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const limitPosition = params.length + 1;
    const offsetPosition = params.length + 2;
    const [countResult, itemsResult] = await Promise.all([
      this.database.query<{ total: number }>(
        `SELECT count(*)::int AS total FROM ${table} ${where}`,
        params,
      ),
      this.database.query<Record<string, unknown>>(
        `SELECT ${columns} FROM ${table} ${where}
         ORDER BY ${orderBy}
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
