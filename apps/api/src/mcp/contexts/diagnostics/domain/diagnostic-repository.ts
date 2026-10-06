import { Page, PageRequest } from "../../../shared/domain/page.js";

export type DiagnosticQuery = PageRequest & {
  serial?: string;
  customerId?: string;
  state?: string;
  diagnostic?: string;
  from?: string;
  to?: string;
};

export interface DiagnosticRepository {
  list(input: DiagnosticQuery): Promise<Page<Record<string, unknown>>>;
}
