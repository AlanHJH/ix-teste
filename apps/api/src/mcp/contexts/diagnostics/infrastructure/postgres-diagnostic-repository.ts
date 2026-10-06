import { Queryable } from "../../../shared/infrastructure/database.js";
import {
  DiagnosticQuery,
  DiagnosticRepository,
} from "../domain/diagnostic-repository.js";

export class PostgresDiagnosticRepository implements DiagnosticRepository {
  constructor(private readonly database: Queryable) {}

  async list(input: DiagnosticQuery) {
    const params: unknown[] = [];
    const conditions: string[] = [];
    this.filter(conditions, params, "d.serial", input.serial);
    this.filter(conditions, params, "i.customer_id", input.customerId);
    this.filter(conditions, params, "d.state", input.state);
    this.filter(conditions, params, "d.diagnostic", input.diagnostic);
    this.filter(conditions, params, "d.ts", input.from, ">=");
    this.filter(conditions, params, "d.ts", input.to, "<=");
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const limitPosition = params.length + 1;
    const offsetPosition = params.length + 2;
    const [countResult, itemsResult] = await Promise.all([
      this.database.query<{ total: number }>(
        `SELECT count(*)::int AS total
         FROM diagnostics d LEFT JOIN inventory i USING(serial) ${where}`,
        params,
      ),
      this.database.query<Record<string, unknown>>(
        `SELECT d.ts::text, d.serial, i.customer_id, d.requested_by,
          d.diagnostic, d.state, d.download_mbps, d.upload_mbps, d.test_server
         FROM diagnostics d LEFT JOIN inventory i USING(serial)
         ${where}
         ORDER BY d.ts DESC, d.serial
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
