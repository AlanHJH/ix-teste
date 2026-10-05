DROP MATERIALIZED VIEW IF EXISTS daily_cpe_metrics CASCADE;

CREATE MATERIALIZED VIEW daily_cpe_metrics AS
SELECT
  (i.ts AT TIME ZONE 'America/Sao_Paulo')::date AS day,
  i.serial,
  inv.customer_id,
  inv.vendor,
  inv.model,
  inv.hw_revision,
  i.software_version,
  inv.plan_mbps,
  inv.previous_plan_mbps,
  inv.plan_since,
  inv.olt,
  inv.pon_port,
  inv.cto,
  inv.city,
  inv.neighborhood,
  count(*)::integer AS inform_count,
  min(i.mem_free_kb::double precision / NULLIF(i.mem_total_kb, 0) * 100) AS mem_min_pct,
  avg(i.mem_free_kb::double precision / NULLIF(i.mem_total_kb, 0) * 100) AS mem_avg_pct,
  min(i.lan1_bit_rate) AS lan_min_mbps,
  max(i.lan1_bit_rate) AS lan_max_mbps,
  count(*) FILTER (WHERE i.event_codes LIKE '%BOOT%')::integer AS reboot_count,
  GREATEST(max(i.pon_fec_uncorrectable) - min(i.pon_fec_uncorrectable), 0) AS fec_errors,
  min(
    CASE inv.vendor
      WHEN 'Kestrel' THEN i.optical_rx_power / 1000.0
      WHEN 'Norvik' THEN 10 * log(NULLIF(i.optical_rx_power, 0))
      ELSE i.optical_rx_power
    END
  ) AS optical_rx_min_dbm,
  avg(
    CASE inv.vendor
      WHEN 'Kestrel' THEN i.optical_rx_power / 1000.0
      WHEN 'Norvik' THEN 10 * log(NULLIF(i.optical_rx_power, 0))
      ELSE i.optical_rx_power
    END
  ) AS optical_rx_avg_dbm,
  avg(i.wifi_rssi_avg) AS wifi_signal_avg_raw
FROM informs i
JOIN inventory inv USING (serial)
GROUP BY
  (i.ts AT TIME ZONE 'America/Sao_Paulo')::date,
  i.serial, inv.customer_id, inv.vendor, inv.model, inv.hw_revision,
  i.software_version, inv.plan_mbps, inv.previous_plan_mbps, inv.plan_since,
  inv.olt, inv.pon_port, inv.cto, inv.city, inv.neighborhood;

-- Uma CPE pode trocar de firmware no meio do dia; a versão faz parte do grão.
CREATE UNIQUE INDEX daily_cpe_metrics_pk ON daily_cpe_metrics(day, serial, software_version);
CREATE INDEX daily_cpe_metrics_customer_idx ON daily_cpe_metrics(customer_id, day DESC);
CREATE INDEX daily_cpe_metrics_network_idx ON daily_cpe_metrics(olt, pon_port, day DESC);
CREATE INDEX daily_cpe_metrics_firmware_idx ON daily_cpe_metrics(software_version, day DESC);
CREATE INDEX IF NOT EXISTS inventory_customer_idx ON inventory(customer_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS inventory_network_idx ON inventory(olt, pon_port) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS tickets_customer_idx ON tickets(customer_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS tickets_opened_idx ON tickets(opened_at);
CREATE INDEX IF NOT EXISTS diagnostics_serial_idx ON diagnostics(serial, ts DESC);
CREATE INDEX IF NOT EXISTS informs_serial_ts_idx ON informs(serial, ts DESC);

ANALYZE inventory;
ANALYZE tickets;
ANALYZE diagnostics;
ANALYZE daily_cpe_metrics;
