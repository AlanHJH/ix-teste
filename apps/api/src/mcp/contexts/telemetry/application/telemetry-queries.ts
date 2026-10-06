import {
  DailyMetricQuery,
  InformQuery,
  TelemetryRepository,
} from "../domain/telemetry-repository.js";

export class TelemetryQueries {
  constructor(private readonly repository: TelemetryRepository) {}

  listInforms(input: InformQuery) {
    return this.repository.listInforms(input);
  }

  listDailyMetrics(input: DailyMetricQuery) {
    return this.repository.listDailyMetrics(input);
  }
}
