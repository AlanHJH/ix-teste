import { DatabaseService } from "../../database";
import type {
  DiagnosticFacets,
  DiagnosticFilterKind,
  DiagnosticFilterOptions,
  DiagnosticRow,
  DiagnosticSummary,
  ListDiagnosticsQuery,
} from "../domain/diagnostic";
import type {
  DiagnosticListResult,
  DiagnosticsRepository,
} from "../application/diagnostic-repository";

type SummaryRow = DiagnosticSummary;

export class PostgresDiagnosticsRepository implements DiagnosticsRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(input: ListDiagnosticsQuery): Promise<DiagnosticListResult> {
    const search = input.query ? `%${input.query}%` : "";
    const state = input.state === "all" ? "" : input.state;
    const requestedBy = input.requestedBy === "all" ? "" : input.requestedBy;
    const params: unknown[] = [
      search,
      state,
      requestedBy,
      input.serial,
      input.customerId,
      input.diagnostic,
      input.from,
      input.to,
    ];
    const conditions = [
      `
      ($1 = '' OR d.serial ILIKE $1 OR i.customer_id ILIKE $1
        OR i.vendor ILIKE $1 OR i.model ILIKE $1)
      AND ($2 = '' OR d.state = $2)
      AND ($3 = '' OR d.requested_by = $3)
      AND ($4 = '' OR d.serial = $4)
      AND ($5 = '' OR i.customer_id = $5)
      AND ($6 = '' OR d.diagnostic = $6)
      AND ($7 = '' OR d.ts >= NULLIF($7, '')::timestamptz)
      AND ($8 = '' OR d.ts < CASE
        WHEN $8 ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          THEN NULLIF($8, '')::date + INTERVAL '1 day'
        ELSE NULLIF($8, '')::timestamptz + INTERVAL '1 microsecond'
      END)`,
    ];
    const columns: Record<DiagnosticFilterKind, string> = {
      serial: "d.serial",
      customer: "i.customer_id",
      vendor: "i.vendor",
      model: "i.model",
      state: "d.state",
      requestedBy: "d.requested_by",
      diagnostic: "d.diagnostic",
      olt: "i.olt",
      pon: "i.pon_port",
      cto: "i.cto",
      testServer: "d.test_server",
    };
    const groupedFilters = new Map<DiagnosticFilterKind, string[]>();
    for (const filter of input.filters) {
      groupedFilters.set(filter.kind, [
        ...(groupedFilters.get(filter.kind) ?? []),
        filter.value,
      ]);
    }
    for (const [kind, values] of groupedFilters) {
      params.push(values);
      conditions.push(`${columns[kind]} = ANY($${params.length}::text[])`);
    }

    const where = conditions.join(" AND ");
    const offset = (input.page - 1) * input.pageSize;
    const orderBy: Record<string, string> = {
      ts_desc: "d.ts DESC, d.serial ASC",
      ts_asc: "d.ts ASC, d.serial ASC",
      serial_asc: "d.serial ASC, d.ts DESC",
      serial_desc: "d.serial DESC, d.ts DESC",
      state_asc: "d.state ASC, d.ts DESC, d.serial ASC",
      state_desc: "d.state DESC, d.ts DESC, d.serial ASC",
      download_mbps_desc: "d.download_mbps DESC NULLS LAST, d.ts DESC",
      download_mbps_asc: "d.download_mbps ASC NULLS LAST, d.ts DESC",
      olt_asc:
        "i.olt ASC NULLS LAST, i.pon_port ASC NULLS LAST, i.cto ASC NULLS LAST, d.ts DESC",
      olt_desc:
        "i.olt DESC NULLS LAST, i.pon_port DESC NULLS LAST, i.cto DESC NULLS LAST, d.ts DESC",
      failures_first:
        "CASE WHEN d.state = 'Completed' THEN 1 ELSE 0 END, d.ts DESC, d.serial ASC",
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
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, input.pageSize, offset],
      ),
      this.database.query<DiagnosticFacets>(`
        SELECT
          ARRAY(SELECT DISTINCT state FROM diagnostics ORDER BY state) AS states,
          ARRAY(SELECT DISTINCT requested_by FROM diagnostics ORDER BY requested_by) AS requested_by`),
    ]);

    const summary = summaryResult.rows[0] ?? {
      total: 0,
      completed: 0,
      errors: 0,
      avg_download_mbps: null,
      avg_upload_mbps: null,
    };
    return {
      rows: itemsResult.rows,
      total: summary.total,
      summary,
      facets: optionsResult.rows[0] ?? { states: [], requested_by: [] },
    };
  }

  async filterOptions(
    query: string,
    page: number,
    pageSize: number,
    sort: string,
    kind: DiagnosticFilterKind | "" = "",
  ) {
    const search = query.trim().slice(0, 120);
    const result = await this.database.query<
      DiagnosticFilterOptions & { total_items: number }
    >(
      `WITH base AS (
         SELECT d.serial, d.requested_by, d.diagnostic, d.state,
           d.test_server, i.customer_id, i.vendor, i.model, i.olt,
           i.pon_port AS pon, i.cto
         FROM diagnostics d
         LEFT JOIN inventory i USING(serial)
       ), options AS (
         SELECT 'serial'::text AS kind, serial::text AS value,
           serial::text AS label, min(coalesce(vendor || ' ' || model, 'CPE')) AS detail,
           count(*)::int AS count FROM base GROUP BY serial
         UNION ALL
         SELECT 'customer', customer_id, customer_id, 'Cliente', count(*)::int
           FROM base WHERE customer_id IS NOT NULL GROUP BY customer_id
         UNION ALL
         SELECT 'vendor', vendor, vendor, 'Fabricante', count(*)::int
           FROM base WHERE vendor IS NOT NULL GROUP BY vendor
         UNION ALL
         SELECT 'model', model, model, min(coalesce(vendor, 'Modelo')), count(*)::int
           FROM base WHERE model IS NOT NULL GROUP BY model
         UNION ALL
         SELECT 'state', state,
           CASE WHEN state = 'Completed' THEN 'Concluído' ELSE state END,
           'Estado do teste', count(*)::int FROM base GROUP BY state
         UNION ALL
         SELECT 'requestedBy', requested_by, requested_by, 'Solicitado por', count(*)::int
           FROM base GROUP BY requested_by
         UNION ALL
         SELECT 'diagnostic', diagnostic, diagnostic, 'Tipo de diagnóstico', count(*)::int
           FROM base GROUP BY diagnostic
         UNION ALL
         SELECT 'olt', olt, olt, 'OLT', count(*)::int
           FROM base WHERE olt IS NOT NULL GROUP BY olt
         UNION ALL
         SELECT 'pon', pon, pon, 'Porta PON', count(*)::int
           FROM base WHERE pon IS NOT NULL GROUP BY pon
         UNION ALL
         SELECT 'cto', cto, cto, 'CTO', count(*)::int
           FROM base WHERE cto IS NOT NULL GROUP BY cto
         UNION ALL
         SELECT 'testServer', test_server, test_server, 'Servidor de teste', count(*)::int
           FROM base WHERE test_server IS NOT NULL GROUP BY test_server
       )
       SELECT kind, value, label, detail, count,
         count(*) OVER()::int AS total_items
       FROM options
       WHERE (($1 = '' AND kind IN ('state', 'requestedBy', 'diagnostic', 'olt'))
          OR ($1 <> '' AND (value ILIKE $1 OR label ILIKE $1 OR detail ILIKE $1)))
         AND ($4 = '' OR kind = $4)
       ORDER BY ${
         sort === "label_desc"
           ? "label DESC, kind ASC"
           : sort === "label_asc"
             ? "label ASC, kind ASC"
             : `CASE
                 WHEN lower(label) = lower(trim(both '%' from $1)) THEN 0
                 WHEN lower(label) LIKE lower(trim(both '%' from $1)) || '%' THEN 1
                 WHEN label ILIKE $1 THEN 2
                 ELSE 3 END,
               CASE kind
                 WHEN 'state' THEN 0 WHEN 'requestedBy' THEN 1
                 WHEN 'diagnostic' THEN 2 WHEN 'olt' THEN 3
                 WHEN 'pon' THEN 4 WHEN 'cto' THEN 5
                 WHEN 'customer' THEN 6 WHEN 'serial' THEN 7
                 WHEN 'vendor' THEN 8 ELSE 9 END,
               count DESC, label ASC`
       }
       LIMIT $2 OFFSET $3`,
      [search ? `%${search}%` : "", pageSize, (page - 1) * pageSize, kind],
    );
    const total = result.rows[0]?.total_items ?? 0;
    return {
      rows: result.rows.map(({ total_items: _totalItems, ...row }) => row),
      total,
    };
  }
}
