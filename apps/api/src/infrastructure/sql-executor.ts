import type { QueryResult, QueryResultRow } from "pg";

export const SQL_EXECUTOR = Symbol("SQL_EXECUTOR");

export interface SqlExecutor {
  query<T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
}
