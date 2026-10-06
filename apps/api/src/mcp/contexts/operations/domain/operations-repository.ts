import type {
  GroupingCandidate,
  GroupingScopeType,
} from "../../../../grouping-candidates.js";

export interface OperationsRepository {
  datasetLoads(): Promise<Record<string, unknown>[]>;
  groupingCandidates(input: {
    scopeType?: GroupingScopeType;
    limit: number;
  }): Promise<GroupingCandidate[]>;
  activeGroupings(input: {
    scopeType?: GroupingScopeType;
    limit: number;
  }): Promise<Record<string, unknown>[]>;
}
