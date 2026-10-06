export interface OperationsRepository {
  datasetLoads(): Promise<Record<string, unknown>[]>;
}
