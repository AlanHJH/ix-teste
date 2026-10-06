import { OperationsRepository } from "../domain/operations-repository.js";
import type { GroupingScopeType } from "../../../../grouping-candidates.js";

export class OperationsQueries {
  constructor(private readonly repository: OperationsRepository) {}

  datasetLoads() {
    return this.repository.datasetLoads();
  }

  groupingCandidates(input: { scopeType?: GroupingScopeType; limit: number }) {
    return this.repository.groupingCandidates(input);
  }

  activeGroupings(input: { scopeType?: GroupingScopeType; limit: number }) {
    return this.repository.activeGroupings(input);
  }
}
