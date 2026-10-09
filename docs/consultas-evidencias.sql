-- Crescimento de chamados técnicos: primeiras duas x últimas duas semanas.
WITH weekly AS (
  SELECT ((opened_at AT TIME ZONE 'America/Sao_Paulo')::date - DATE '2026-07-06') / 7 + 1 AS week_number,
    ticket_id, customer_id, resolution
  FROM tickets
  WHERE category IN ('Lentidão', 'Sem conexão', 'Wi-Fi')
)
SELECT CASE WHEN week_number <= 2 THEN 'primeiras_2' ELSE 'ultimas_2' END AS period,
  count(*) AS tickets,
  count(DISTINCT customer_id) AS customers,
  count(*) FILTER (WHERE resolution='Escalado para NOC') AS noc,
  count(*) FILTER (WHERE resolution='Visita técnica agendada') AS visits
FROM weekly
WHERE week_number <= 2 OR week_number >= 7
GROUP BY 1;

-- Memória e boots por firmware na semana final.
WITH bounds AS (SELECT max(day) AS max_day FROM daily_cpe_metrics)
SELECT software_version, count(DISTINCT serial) AS cpes,
  round(min(mem_min_pct)::numeric, 1) AS minimum_free_memory_pct,
  sum(reboot_count) AS boots,
  count(*) FILTER (WHERE mem_min_pct < 10) AS critical_device_days
FROM daily_cpe_metrics, bounds
WHERE day > max_day - 7 AND vendor='Kestrel'
GROUP BY software_version;

-- A memória crítica aparece somente depois do início do rollout em 20/07.
SELECT software_version,
  count(*) FILTER (WHERE day < DATE '2026-07-20' AND mem_min_pct < 10) AS critical_before_rollout,
  count(*) FILTER (WHERE day >= DATE '2026-07-20' AND mem_min_pct < 10) AS critical_after_rollout
FROM daily_cpe_metrics
WHERE vendor='Kestrel'
GROUP BY software_version;

-- Concentração de FEC na rede.
WITH bounds AS (SELECT max(day) AS max_day FROM daily_cpe_metrics)
SELECT m.olt, m.pon_port, m.neighborhood, count(DISTINCT m.serial) AS cpes,
  sum(m.fec_errors) AS fec_errors
FROM daily_cpe_metrics m
JOIN inventory i USING (serial), bounds
WHERE m.day > max_day - 7 AND i.status='active'
GROUP BY m.olt, m.pon_port, m.neighborhood
ORDER BY fec_errors DESC
LIMIT 15;

-- Evolução dos chamados técnicos nas PONs 1/7 e 1/8, respeitando a vigência do equipamento.
WITH network_tickets AS (
  SELECT DISTINCT t.ticket_id, t.opened_at
  FROM tickets t
  JOIN inventory i ON i.customer_id=t.customer_id
  WHERE t.category IN ('Lentidão','Sem conexão','Wi-Fi')
    AND i.olt='OLT-2' AND i.pon_port IN ('1/7','1/8')
    AND t.opened_at::date >= i.installed_at
    AND (i.removed_at IS NULL OR t.opened_at::date <= i.removed_at)
)
SELECT count(*) FILTER (WHERE opened_at::date BETWEEN DATE '2026-07-06' AND DATE '2026-07-19') AS first_two_weeks,
  count(*) FILTER (WHERE opened_at::date BETWEEN DATE '2026-08-17' AND DATE '2026-08-30') AS last_two_weeks
FROM network_tickets;

-- Clientes Turbo 500 incompatíveis com Norvik revisão A.
SELECT count(*) AS affected
FROM inventory
WHERE status='active' AND vendor='Norvik' AND hw_revision='A'
  AND previous_plan_mbps IS NOT NULL AND plan_mbps > 100
  AND plan_since >= DATE '2026-07-13';

-- Total de upgrades Turbo 500 ainda ativos no fim do período.
SELECT count(*) AS active_upgrades
FROM inventory
WHERE status='active' AND previous_plan_mbps IN (100,300)
  AND plan_mbps=500 AND plan_since >= DATE '2026-07-13';

-- Sinal óptico isolado precisa persistir em pelo menos 2 dos 3 dias finais.
WITH bounds AS (SELECT max(day) AS max_day FROM daily_cpe_metrics), affected AS (
  SELECT m.serial
  FROM daily_cpe_metrics m
  JOIN inventory i USING (serial), bounds
  WHERE m.day > max_day - 3 AND i.status='active'
    AND NOT (m.olt='OLT-2' AND m.pon_port IN ('1/7','1/8'))
  GROUP BY m.serial
  HAVING count(DISTINCT m.day) FILTER (WHERE m.optical_rx_min_dbm < -27) >= 2
)
SELECT count(*) AS persistent_optical_cases FROM affected;

-- Taxa comparável entre fabricantes; evita confundir base maior com pior qualidade.
SELECT i.vendor, count(DISTINCT i.customer_id) AS active_customers,
  count(t.ticket_id) AS technical_tickets,
  round(count(t.ticket_id)::numeric / count(DISTINCT i.customer_id) * 1000, 1) AS tickets_per_1000
FROM inventory i
LEFT JOIN tickets t ON t.customer_id=i.customer_id
  AND t.category IN ('Lentidão','Sem conexão','Wi-Fi')
WHERE i.status='active'
GROUP BY i.vendor
ORDER BY i.vendor;

-- Análise detalhada da OLT-2/PON 1/7.
-- A última data da visão materializada é a referência da janela recente.
WITH bounds AS (
  SELECT max(day) AS max_day FROM daily_cpe_metrics
), scope AS (
  SELECT serial, customer_id, cto, vendor, model, hw_revision,
    software_version, plan_mbps
  FROM inventory
  WHERE status='active' AND olt='OLT-2' AND pon_port='1/7'
), recent AS (
  SELECT m.*
  FROM daily_cpe_metrics m, bounds b
  WHERE m.olt='OLT-2' AND m.pon_port='1/7'
    AND m.day > b.max_day - 7
), per_cpe AS (
  SELECT s.*, count(r.day)::int AS days_seen,
    coalesce(sum(r.fec_errors), 0)::bigint AS fec_7d,
    max(r.fec_errors)::bigint AS peak_fec_day,
    min(r.optical_rx_min_dbm)::numeric(8,2) AS min_rx,
    avg(r.optical_rx_avg_dbm)::numeric(8,2) AS avg_rx,
    count(*) FILTER (WHERE r.optical_rx_min_dbm < -27)::int AS low_rx_days,
    coalesce(sum(r.reboot_count), 0)::int AS reboots
  FROM scope s
  LEFT JOIN recent r USING (serial)
  GROUP BY s.serial, s.customer_id, s.cto, s.vendor, s.model,
    s.hw_revision, s.software_version, s.plan_mbps
)
SELECT
  (SELECT max_day::text FROM bounds) AS latest_day,
  count(*) AS scope_cpes,
  count(*) FILTER (WHERE fec_7d >= 10000) AS cpes_with_fec,
  count(*) FILTER (WHERE low_rx_days >= 2) AS cpes_with_recurrent_optical_low,
  count(*) FILTER (WHERE low_rx_days > 0) AS cpes_with_any_optical_low,
  count(*) FILTER (WHERE reboots > 0) AS cpes_with_reboots
FROM per_cpe;

-- Distribuição do sinal por CTO dentro da PON 1/7.
WITH bounds AS (
  SELECT max(day) AS max_day FROM daily_cpe_metrics
), recent AS (
  SELECT m.*
  FROM daily_cpe_metrics m, bounds b
  WHERE m.olt='OLT-2' AND m.pon_port='1/7'
    AND m.day > b.max_day - 7
), per_cpe AS (
  SELECT i.cto, i.serial,
    coalesce(sum(r.fec_errors), 0)::bigint AS fec_7d,
    min(r.optical_rx_min_dbm)::numeric(8,2) AS min_rx,
    avg(r.optical_rx_avg_dbm)::numeric(8,2) AS avg_rx,
    count(*) FILTER (WHERE r.optical_rx_min_dbm < -27)::int AS low_rx_days
  FROM inventory i
  LEFT JOIN recent r USING (serial)
  WHERE i.status='active' AND i.olt='OLT-2' AND i.pon_port='1/7'
  GROUP BY i.cto, i.serial
)
SELECT cto, count(*) AS cpes,
  count(*) FILTER (WHERE fec_7d >= 10000) AS fec_affected,
  count(*) FILTER (WHERE low_rx_days >= 2) AS optical_recurrent,
  round(avg(avg_rx), 2) AS avg_rx,
  min(min_rx) AS worst_rx
FROM per_cpe
GROUP BY cto
ORDER BY cto;

-- Impacto percebido em chamados e disponibilidade dos diagnósticos.
WITH scope AS (
  SELECT serial, customer_id
  FROM inventory
  WHERE status='active' AND olt='OLT-2' AND pon_port='1/7'
), ticket_summary AS (
  SELECT count(*)::int AS total_tickets,
    count(DISTINCT t.customer_id)::int AS customers,
    count(*) FILTER (WHERE t.category='Sem conexão')::int AS no_connection,
    count(*) FILTER (WHERE t.category='Lentidão')::int AS slowness,
    count(*) FILTER (WHERE t.category='Wi-Fi')::int AS wifi
  FROM tickets t JOIN scope s USING (customer_id)
), diagnostic_summary AS (
  SELECT count(*)::int AS total_diagnostics,
    count(*) FILTER (WHERE d.state='Completed')::int AS completed,
    count(*) FILTER (WHERE d.state <> 'Completed')::int AS errors,
    round(avg(d.download_mbps) FILTER (WHERE d.state='Completed')::numeric, 1) AS avg_download_mbps,
    round(avg(d.upload_mbps) FILTER (WHERE d.state='Completed')::numeric, 1) AS avg_upload_mbps
  FROM diagnostics d JOIN scope s USING (serial)
)
SELECT row_to_json(ticket_summary) AS tickets,
  row_to_json(diagnostic_summary) AS diagnostics
FROM ticket_summary CROSS JOIN diagnostic_summary;
