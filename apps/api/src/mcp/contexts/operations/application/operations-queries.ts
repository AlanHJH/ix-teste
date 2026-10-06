import { OperationsRepository } from "../domain/operations-repository.js";

export class OperationsQueries {
  constructor(private readonly repository: OperationsRepository) {}

  datasetLoads() {
    return this.repository.datasetLoads();
  }
}
