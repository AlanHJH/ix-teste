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
