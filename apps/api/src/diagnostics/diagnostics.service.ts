import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database";
import { paginate } from "../pagination";

type DiagnosticRow = {
  ts: string;
  serial: string;
  requested_by: string;
  diagnostic: string;
  state: string;
  download_mbps: number | null;
  upload_mbps: number | null;
  test_server: string | null;
  customer_id: string | null;
  vendor: string | null;
  model: string | null;
  plan_mbps: number | null;
  city: string | null;
  neighborhood: string | null;
  olt: string | null;
  pon: string | null;
  cto: string | null;
};

type SummaryRow = {
  total: number;
  completed: number;
  errors: number;
  avg_download_mbps: number | null;
  avg_upload_mbps: number | null;
};

type ListInput = {
  query: string;
  page: number;
  pageSize: number;
  sort: string;
  state: string;
  requestedBy: string;
  serial: string;
  customerId: string;
  diagnostic: string;
  from: string;
  to: string;
};

@Injectable()
export class DiagnosticsService {
  constructor(private readonly database: DatabaseService) {}

  async list(input: ListInput) {
    const query = input.query.trim();
    const state = input.state === "all" ? "" : input.state;
    const requestedBy = input.requestedBy === "all" ? "" : input.requestedBy;
    const serial = input.serial.trim();
    const customerId = input.customerId.trim();
    const diagnostic = input.diagnostic.trim();
    const from = input.from.trim();
    const to = input.to.trim();
    const search = query ? `%${query}%` : "";
    const params = [
      search,
      state,
      requestedBy,
      serial,
      customerId,
      diagnostic,
      from,
      to,
    ];
    const where = `
      ($1 = '' OR d.serial ILIKE $1 OR i.customer_id ILIKE $1
        OR i.vendor ILIKE $1 OR i.model ILIKE $1)
      AND ($2 = '' OR d.state = $2)
      AND ($3 = '' OR d.requested_by = $3)
      AND ($4 = '' OR d.serial = $4)
      AND ($5 = '' OR i.customer_id = $5)
      AND ($6 = '' OR d.diagnostic = $6)
      AND ($7 = '' OR d.ts >= NULLIF($7, '')::timestamptz)
      AND ($8 = '' OR d.ts <= NULLIF($8, '')::timestamptz)`;
    const offset = (input.page - 1) * input.pageSize;
    const orderBy: Record<string, string> = {
      ts_desc: "d.ts DESC, d.serial ASC",
      ts_asc: "d.ts ASC, d.serial ASC",
      serial_asc: "d.serial ASC, d.ts DESC",
      download_mbps_desc: "d.download_mbps DESC NULLS LAST, d.ts DESC",
    };

    const [summaryResult, itemsResult, optionsResult] = await Promise.all([
      this.database.query<SummaryRow>(
        `
          SELECT
            count(*)::int AS total,
            count(*) FILTER (WHERE d.state = 'Completed')::int AS completed,
            count(*) FILTER (WHERE d.state <> 'Completed')::int AS errors,
            round(avg(d.download_mbps) FILTER (WHERE d.state = 'Completed')::numeric, 1) AS avg_download_mbps,
            round(avg(d.upload_mbps) FILTER (WHERE d.state = 'Completed')::numeric, 1) AS avg_upload_mbps
          FROM diagnostics d
          LEFT JOIN inventory i USING(serial)
          WHERE ${where}`,
        params,
      ),
      this.database.query<DiagnosticRow>(
        `
          SELECT d.ts::text, d.serial, d.requested_by, d.diagnostic, d.state,
            d.download_mbps, d.upload_mbps, d.test_server, i.customer_id,
            i.vendor, i.model, i.plan_mbps, i.city, i.neighborhood, i.olt,
            i.pon_port AS pon, i.cto
          FROM diagnostics d
          LEFT JOIN inventory i USING(serial)
          WHERE ${where}
          ORDER BY ${orderBy[input.sort] ?? orderBy.ts_desc}
          LIMIT $9 OFFSET $10`,
        [...params, input.pageSize, offset],
      ),
      this.database.query<{ states: string[]; requested_by: string[] }>(`
        SELECT
          ARRAY(SELECT DISTINCT state FROM diagnostics ORDER BY state) AS states,
          ARRAY(SELECT DISTINCT requested_by FROM diagnostics ORDER BY requested_by) AS requested_by`),
    ]);

    return paginate(
      itemsResult.rows,
      summaryResult.rows[0].total,
      input.page,
      input.pageSize,
      {
        summary: summaryResult.rows[0],
        filters: optionsResult.rows[0],
      },
    );
  }
}
