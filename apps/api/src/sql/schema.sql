CREATE TABLE IF NOT EXISTS dataset_loads (
  dataset_key text PRIMARY KEY,
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS inventory (
  serial text PRIMARY KEY,
  customer_id text NOT NULL,
  vendor text NOT NULL,
  model text NOT NULL,
  hw_revision text NOT NULL,
  software_version text NOT NULL,
  plan_mbps integer NOT NULL,
  previous_plan_mbps integer,
  plan_since date NOT NULL,
  customer_since date NOT NULL,
  customer_status text NOT NULL,
  cancelled_at date,
  olt text NOT NULL,
  pon_port text NOT NULL,
  cto text NOT NULL,
  city text NOT NULL,
  neighborhood text NOT NULL,
  installed_at date NOT NULL,
  status text NOT NULL,
  removed_at date
);

CREATE TABLE IF NOT EXISTS tickets (
  ticket_id text PRIMARY KEY,
  opened_at timestamptz NOT NULL,
  customer_id text NOT NULL,
  channel text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  resolution text NOT NULL,
  closed_at timestamptz
);

CREATE TABLE IF NOT EXISTS diagnostics (
  ts timestamptz NOT NULL,
  serial text NOT NULL,
  requested_by text NOT NULL,
  diagnostic text NOT NULL,
  state text NOT NULL,
  download_mbps double precision,
  upload_mbps double precision,
  test_server text
);

-- UNLOGGED reduz o custo da carga do prototipo. O arquivo original continua sendo
-- a fonte reproduzivel; em producao a ingestao seria feita por streaming.
CREATE UNLOGGED TABLE IF NOT EXISTS informs (
  ts timestamptz NOT NULL,
  serial text NOT NULL,
  event_codes text NOT NULL,
  software_version text NOT NULL,
  uptime_s bigint,
  mem_total_kb bigint,
  mem_free_kb bigint,
  optical_rx_power double precision,
  optical_tx_power double precision,
  pon_fec_uncorrectable bigint,
  wan_bytes_rx bigint,
  wan_bytes_tx bigint,
  lan1_bit_rate integer,
  wifi_clients_24g integer,
  wifi_clients_5g integer,
  wifi_rssi_avg double precision
);

