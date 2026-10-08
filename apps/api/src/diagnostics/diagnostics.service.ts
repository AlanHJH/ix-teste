import { Inject, Injectable } from "@nestjs/common";
import { paginate } from "../pagination";
import {
  DIAGNOSTICS_REPOSITORY,
  DiagnosticsRepository,
} from "./application/diagnostic-repository";
import type {
  DiagnosticFilter,
  DiagnosticFilterKind,
  ListDiagnosticsQuery,
} from "./domain/diagnostic";

export type {
  DiagnosticFilter,
  DiagnosticFilterKind,
  ListDiagnosticsQuery,
} from "./domain/diagnostic";

@Injectable()
export class DiagnosticsService {
  constructor(
    @Inject(DIAGNOSTICS_REPOSITORY)
    private readonly repository: DiagnosticsRepository,
  ) {}

  async list(input: ListDiagnosticsQuery) {
    const result = await this.repository.list({
      ...input,
      query: input.query.trim(),
      serial: input.serial.trim(),
      customerId: input.customerId.trim(),
      diagnostic: input.diagnostic.trim(),
      from: input.from.trim(),
      to: input.to.trim(),
    });
    return paginate(result.rows, result.total, input.page, input.pageSize, {
      summary: result.summary,
      filters: result.facets,
    });
  }

  async filterOptions(
    query: string,
    page: number,
    pageSize: number,
    sort: string,
    kind: DiagnosticFilterKind | "" = "",
  ) {
    const result = await this.repository.filterOptions(
      query,
      page,
      pageSize,
      sort,
      kind,
    );
    return paginate(result.rows, result.total, page, pageSize);
  }
}
