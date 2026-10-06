import {
  DiagnosticQuery,
  DiagnosticRepository,
} from "../domain/diagnostic-repository.js";

export class DiagnosticQueries {
  constructor(private readonly repository: DiagnosticRepository) {}

  list(input: DiagnosticQuery) {
    return this.repository.list(input);
  }
}
