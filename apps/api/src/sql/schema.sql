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

CREATE INDEX IF NOT EXISTS inventory_active_customer_idx
  ON inventory (customer_id) WHERE status='active';

CREATE INDEX IF NOT EXISTS inventory_active_firmware_idx
  ON inventory (software_version) WHERE status='active';

CREATE INDEX IF NOT EXISTS inventory_active_equipment_idx
  ON inventory (vendor, model, hw_revision) WHERE status='active';

CREATE INDEX IF NOT EXISTS inventory_active_region_idx
  ON inventory (city, neighborhood) WHERE status='active';

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'dataset'
    CHECK (source IN ('dataset', 'n1')),
  ADD COLUMN IF NOT EXISTS opened_by text,
  ADD COLUMN IF NOT EXISTS related_problem_id text,
  ADD COLUMN IF NOT EXISTS noc_status text NOT NULL DEFAULT 'not_applicable'
    CHECK (noc_status IN ('not_applicable', 'pending', 'in_progress', 'linked', 'closed'));

ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_noc_status_check;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_noc_status_check
  CHECK (noc_status IN ('not_applicable', 'pending', 'in_progress', 'linked', 'closed'));

UPDATE tickets
SET noc_status='pending'
WHERE source='n1' AND resolution='Escalado para NOC'
  AND noc_status='not_applicable';

CREATE INDEX IF NOT EXISTS tickets_source_opened_idx
  ON tickets (source, opened_at DESC);

CREATE INDEX IF NOT EXISTS tickets_related_problem_idx
  ON tickets (related_problem_id, opened_at DESC)
  WHERE related_problem_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tickets_noc_status_opened_idx
  ON tickets (noc_status, opened_at ASC)
  WHERE source='n1' AND resolution='Escalado para NOC';

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

-- Fila auditável do plano de investigação. O agente apenas propõe um incidente;
-- a criação do incidente operacional acontece somente após revisão humana.
CREATE TABLE IF NOT EXISTS agent_investigations (
  investigation_id text PRIMARY KEY,
  dedup_key text NOT NULL UNIQUE,
  trigger_type text NOT NULL CHECK (trigger_type IN ('metric', 'schedule', 'manual')),
  trigger_label text NOT NULL,
  objective text NOT NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (
    status IN ('queued', 'running', 'no_problem', 'inconclusive', 'pending_review', 'approved', 'rejected', 'failed')
  ),
  model text,
  openai_response_id text,
  finding jsonb,
  tool_trace jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text
);

CREATE INDEX IF NOT EXISTS agent_investigations_status_created_idx
  ON agent_investigations (status, created_at DESC);

CREATE TABLE IF NOT EXISTS operational_incidents (
  incident_id text PRIMARY KEY,
  investigation_id text UNIQUE REFERENCES agent_investigations(investigation_id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'mitigating', 'monitoring', 'resolved')),
  category text NOT NULL,
  severity text NOT NULL,
  title text NOT NULL,
  scope jsonb NOT NULL,
  affected_cpes integer NOT NULL,
  confidence double precision NOT NULL,
  probable_cause text NOT NULL,
  recommended_action text NOT NULL,
  evidence jsonb NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  opened_by text NOT NULL,
  approval_note text
);

ALTER TABLE operational_incidents
  ALTER COLUMN investigation_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'agent'
    CHECK (source IN ('agent', 'manual')),
  ADD COLUMN IF NOT EXISTS origin_ticket_id text REFERENCES tickets(ticket_id);

CREATE INDEX IF NOT EXISTS operational_incidents_status_opened_idx
  ON operational_incidents (status, opened_at DESC);

-- Estado dos agrupamentos produzidos pelos detectores analíticos. A definição
-- e as métricas são recalculadas, enquanto o encerramento humano é persistido.
CREATE TABLE IF NOT EXISTS detected_group_states (
  grouping_id text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('resolved')),
  resolved_at timestamptz NOT NULL DEFAULT now()
);

-- Relações lógicas derivadas exclusivamente do inventário. Não representam
-- códigos físicos de campo e são recriadas a cada atualização do dataset.
CREATE TABLE IF NOT EXISTS generated_logical_drops (
  drop_id text PRIMARY KEY,
  serial text NOT NULL UNIQUE,
  customer_id text NOT NULL,
  olt text NOT NULL,
  pon_port text NOT NULL,
  cto text NOT NULL,
  source text NOT NULL CHECK (source = 'generated_from_inventory'),
  confidence text NOT NULL CHECK (confidence = 'estimated'),
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generated_logical_drops_cto_idx
  ON generated_logical_drops (olt, pon_port, cto);

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
