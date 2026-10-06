import { Queryable } from "../../../shared/infrastructure/database.js";
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
}
