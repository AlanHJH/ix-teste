import { Page, PageRequest } from "../../../shared/domain/page.js";

export type InformQuery = PageRequest & {
  serial: string;
  from?: string;
  to?: string;
  eventCode?: string;
  softwareVersion?: string;
};

export type DailyMetricQuery = PageRequest & {
  serial?: string;
  customerId?: string;
  olt?: string;
  pon?: string;
  softwareVersion?: string;
  fromDay?: string;
  toDay?: string;
};

export interface TelemetryRepository {
  listInforms(input: InformQuery): Promise<Page<Record<string, unknown>>>;
  listDailyMetrics(
    input: DailyMetricQuery,
  ): Promise<Page<Record<string, unknown>>>;
}
