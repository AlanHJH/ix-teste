import type { Queryable } from "./mcp/shared/infrastructure/database.js";

export const groupingScopeTypes = [
  "park",
  "olt",
  "pon",
  "cto",
  "customer",
  "firmware",
  "equipment",
  "region",
] as const;

export type GroupingScopeType = (typeof groupingScopeTypes)[number];

export type GroupingCandidate = {
  candidateKey: string;
  scope: {
    type: GroupingScopeType;
    identifier: string;
    olt: string | null;
    pon: string | null;
    cto: string | null;
  };
  signal: "optical" | "fec" | "stability" | "capacity";
  affectedCpes: number;
  totalCpes: number;
  affectedPercent: number;
  peakSignalValue: number;
  summary: string;
};

type CandidateRow = {
  scope_type: GroupingScopeType;
  identifier: string;
  olt: string | null;
  pon: string | null;
  cto: string | null;
  signal: GroupingCandidate["signal"];
  affected_cpes: number;
  total_cpes: number;
  affected_percent: number;
  peak_signal_value: number;
};

const signalLabels: Record<GroupingCandidate["signal"], string> = {
  optical: "sinal óptico abaixo de -27 dBm em dias recorrentes",
  fec: "volume elevado de erros FEC na janela recente",
  stability: "reinícios ou memória livre crítica na janela recente",
  capacity: "plano acima da capacidade negociada na interface LAN",
};

export async function listGroupingCandidates(
  database: Queryable,
  input: { scopeType?: GroupingScopeType; limit?: number } = {},
): Promise<GroupingCandidate[]> {
  const scopeType = input.scopeType ?? "";
  const limit = Math.min(30, Math.max(1, input.limit ?? 8));
  const result = await database.query<CandidateRow>(
    `WITH bounds AS (
       SELECT max(day) AS max_day FROM daily_cpe_metrics
     ), per_cpe AS (
       SELECT i.serial, i.customer_id, i.olt, i.pon_port, i.cto,
         i.city, i.neighborhood, i.vendor, i.model, i.hw_revision,
         i.software_version, i.plan_mbps,
         count(DISTINCT m.day) FILTER (WHERE m.optical_rx_min_dbm < -27)::int AS optical_bad_days,
         coalesce(sum(m.reboot_count), 0)::int AS reboots,
         min(m.mem_min_pct)::double precision AS min_memory,
         coalesce(sum(m.fec_errors), 0)::double precision AS fec_errors,
         min(m.lan_min_mbps)::int AS lan_min_mbps
       FROM inventory i CROSS JOIN bounds b
       LEFT JOIN daily_cpe_metrics m
         ON m.serial=i.serial AND m.day > b.max_day - 7
       WHERE i.status='active'
       GROUP BY i.serial, i.customer_id, i.olt, i.pon_port, i.cto,
         i.city, i.neighborhood, i.vendor, i.model, i.hw_revision,
         i.software_version, i.plan_mbps
     ), flagged AS (
       SELECT p.*, 'optical'::text AS signal,
         optical_bad_days::double precision AS signal_value
       FROM per_cpe p WHERE optical_bad_days >= 2
       UNION ALL
       SELECT p.*, 'fec', fec_errors FROM per_cpe p WHERE fec_errors >= 10000
       UNION ALL
       SELECT p.*, 'stability', greatest(reboots, coalesce(10-min_memory, 0))
       FROM per_cpe p WHERE reboots >= 2 OR min_memory < 10
       UNION ALL
       SELECT p.*, 'capacity', (plan_mbps-lan_min_mbps)::double precision
       FROM per_cpe p
       WHERE plan_mbps > 100 AND lan_min_mbps IS NOT NULL AND lan_min_mbps <= 100
     ), candidates AS (
       SELECT 'park'::text AS scope_type, 'Todo o parque'::text AS identifier,
         NULL::text AS olt, NULL::text AS pon, NULL::text AS cto,
         signal, count(DISTINCT serial)::int AS affected_cpes,
         (SELECT count(*)::int FROM per_cpe) AS total_cpes,
         max(signal_value)::double precision AS peak_signal_value
       FROM flagged GROUP BY signal
       UNION ALL
       SELECT 'olt', olt, olt, NULL, NULL, signal,
         count(DISTINCT serial)::int,
         (SELECT count(*)::int FROM per_cpe p WHERE p.olt=f.olt),
         max(signal_value)::double precision
       FROM flagged f GROUP BY olt, signal
       UNION ALL
       SELECT 'pon', concat(olt, ' · PON ', pon_port), olt, pon_port, NULL,
         signal, count(DISTINCT serial)::int,
         (SELECT count(*)::int FROM per_cpe p
           WHERE p.olt=f.olt AND p.pon_port=f.pon_port),
         max(signal_value)::double precision
       FROM flagged f GROUP BY olt, pon_port, signal
       UNION ALL
       SELECT 'cto', concat(olt, ' · PON ', pon_port, ' · ', cto),
         olt, pon_port, cto, signal, count(DISTINCT serial)::int,
         (SELECT count(*)::int FROM per_cpe p
           WHERE p.olt=f.olt AND p.pon_port=f.pon_port AND p.cto=f.cto),
         max(signal_value)::double precision
       FROM flagged f GROUP BY olt, pon_port, cto, signal
       UNION ALL
       SELECT 'firmware', software_version, NULL, NULL, NULL, signal,
         count(DISTINCT serial)::int,
         (SELECT count(*)::int FROM per_cpe p
           WHERE p.software_version=f.software_version),
         max(signal_value)::double precision
       FROM flagged f GROUP BY software_version, signal
       UNION ALL
       SELECT 'equipment', concat_ws(' ', vendor, model, hw_revision),
         NULL, NULL, NULL, signal, count(DISTINCT serial)::int,
         (SELECT count(*)::int FROM per_cpe p
           WHERE p.vendor=f.vendor AND p.model=f.model
             AND p.hw_revision=f.hw_revision),
         max(signal_value)::double precision
       FROM flagged f GROUP BY vendor, model, hw_revision, signal
       UNION ALL
       SELECT 'region', neighborhood, NULL, NULL, NULL, signal,
         count(DISTINCT serial)::int,
         (SELECT count(*)::int FROM per_cpe p
           WHERE p.neighborhood=f.neighborhood),
         max(signal_value)::double precision
       FROM flagged f GROUP BY neighborhood, signal
       UNION ALL
       SELECT 'customer', customer_id, olt, pon_port, cto, signal,
         1, 1, signal_value
       FROM flagged
     ), ranked AS (
       SELECT *,
         round((100.0 * affected_cpes / nullif(total_cpes, 0))::numeric, 1)::double precision
           AS affected_percent
       FROM candidates
       WHERE total_cpes > 0
     )
     SELECT scope_type, identifier, olt, pon, cto, signal,
       affected_cpes, total_cpes, affected_percent, peak_signal_value
     FROM ranked
     WHERE ($1='' OR scope_type=$1)
       AND CASE scope_type
         WHEN 'park' THEN affected_cpes >= 20 AND affected_percent >= 15
         WHEN 'olt' THEN affected_cpes >= 8 AND affected_percent >= 15
         WHEN 'pon' THEN affected_cpes >= 3 AND affected_percent >= 15
         WHEN 'cto' THEN affected_cpes >= 2 AND affected_percent >= 25
         WHEN 'firmware' THEN affected_cpes >= 8 AND affected_percent >= 10
         WHEN 'equipment' THEN affected_cpes >= 8 AND affected_percent >= 10
         WHEN 'region' THEN affected_cpes >= 5 AND affected_percent >= 15
         WHEN 'customer' THEN true
         ELSE false
       END
     ORDER BY
       (affected_percent * 0.65 + least(affected_cpes, 100) * 0.35) DESC,
       affected_cpes DESC, scope_type, identifier
     LIMIT $2`,
    [scopeType, limit],
  );

  return result.rows.map((row) => ({
    candidateKey: [
      row.scope_type,
      row.identifier,
      row.signal,
      row.olt ?? "",
      row.pon ?? "",
      row.cto ?? "",
    ]
      .join(":")
      .toLowerCase(),
    scope: {
      type: row.scope_type,
      identifier: row.identifier,
      olt: row.olt,
      pon: row.pon,
      cto: row.cto,
    },
    signal: row.signal,
    affectedCpes: row.affected_cpes,
    totalCpes: row.total_cpes,
    affectedPercent: row.affected_percent,
    peakSignalValue: row.peak_signal_value,
    summary: `${row.affected_cpes} de ${row.total_cpes} CPEs (${row.affected_percent}%) apresentam ${signalLabels[row.signal]}.`,
  }));
}
