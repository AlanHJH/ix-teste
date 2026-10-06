import { Queryable } from "../../../shared/infrastructure/database.js";
import {
  GroupingScopeType,
  listGroupingCandidates,
} from "../../../../grouping-candidates.js";
import { OperationsRepository } from "../domain/operations-repository.js";

export class PostgresOperationsRepository implements OperationsRepository {
  constructor(private readonly database: Queryable) {}

  async datasetLoads() {
    const result = await this.database.query<Record<string, unknown>>(`
      SELECT dataset_key, status, started_at::text, finished_at::text, details
      FROM dataset_loads
      ORDER BY started_at DESC`);
    return result.rows;
  }

  groupingCandidates(input: { scopeType?: GroupingScopeType; limit: number }) {
    return listGroupingCandidates(this.database, input);
  }

  async activeGroupings(input: {
    scopeType?: GroupingScopeType;
    limit: number;
  }) {
    const scopeType = input.scopeType ?? "";
    const limit = Math.min(30, Math.max(1, input.limit));
    const result = await this.database.query<Record<string, unknown>>(
      `SELECT incident_id, status, category, severity, title, scope,
          affected_cpes, confidence, probable_cause, recommended_action,
          opened_at::text, opened_by, source, origin_ticket_id
       FROM operational_incidents
       WHERE status IN ('open', 'mitigating', 'monitoring')
         AND ($1='' OR scope->>'type'=$1)
       ORDER BY CASE severity
         WHEN 'critical' THEN 0 WHEN 'high' THEN 1
         WHEN 'medium' THEN 2 ELSE 3 END, opened_at DESC
       LIMIT $2`,
      [scopeType, limit],
    );
    return result.rows;
  }
}
