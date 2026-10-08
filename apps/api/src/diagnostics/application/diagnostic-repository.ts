import type {
  DiagnosticFacets,
  DiagnosticFilterKind,
  DiagnosticFilterOptions,
  DiagnosticRow,
  DiagnosticSummary,
  ListDiagnosticsQuery,
} from "../domain/diagnostic";

export const DIAGNOSTICS_REPOSITORY = Symbol("DIAGNOSTICS_REPOSITORY");

export type DiagnosticListResult = {
  rows: DiagnosticRow[];
  total: number;
  summary: DiagnosticSummary;
  facets: DiagnosticFacets;
};

export interface DiagnosticsRepository {
  list(input: ListDiagnosticsQuery): Promise<DiagnosticListResult>;
  filterOptions(
    query: string,
    page: number,
    pageSize: number,
    sort: string,
    kind: DiagnosticFilterKind | "",
  ): Promise<{
    rows: DiagnosticFilterOptions[];
    total: number;
  }>;
}
