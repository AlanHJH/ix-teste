CREATE TABLE IF NOT EXISTS dataset_loads (
  dataset_key text PRIMARY KEY,
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Composição e layout individual do dashboard. O user_id será fornecido pelo
-- sistema de autenticação; no protótipo ele corresponde ao usuário de demonstração.
CREATE TABLE IF NOT EXISTS dashboard_preferences (
  user_id text PRIMARY KEY,
  composition jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Catálogo de dashboards por usuário. A preferência legada acima permanece
-- para compatibilidade com clientes antigos e é migrada para esta coleção.
CREATE TABLE IF NOT EXISTS dashboard_definitions (
  dashboard_id text PRIMARY KEY,
  user_id text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  composition jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dashboard_definitions_user_updated_idx
  ON dashboard_definitions (user_id, is_default DESC, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS dashboard_definitions_user_name_idx
  ON dashboard_definitions (user_id, lower(name));

INSERT INTO dashboard_definitions(
  dashboard_id, user_id, name, description, is_default, composition,
  created_at, updated_at
)
SELECT
  'legacy-' || user_id,
  user_id,
  COALESCE(NULLIF(composition->>'title', ''), 'Visão executiva'),
  COALESCE(NULLIF(composition->>'subtitle', ''), 'Dashboard principal'),
  true,
  composition,
  updated_at,
  updated_at
FROM dashboard_preferences
ON CONFLICT (dashboard_id) DO NOTHING;

-- Jobs do laboratório de dados. O identificador permite acompanhar progresso,
-- repetir cenários e remover somente os dados sintéticos produzidos pelo job.
CREATE TABLE IF NOT EXISTS data_lab_jobs (
  job_id uuid PRIMARY KEY,
  scenario text NOT NULL CHECK (scenario IN (
    'baseline', 'optical', 'fec', 'firmware', 'capacity', 'missing-inform', 'mixed'
  )),
  status text NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  cpe_count integer NOT NULL,
  days integer NOT NULL,
  informs_per_day integer NOT NULL,
  batch_size integer NOT NULL,
  target_rows bigint NOT NULL,
  processed_cpes integer NOT NULL DEFAULT 0,
  generated_rows bigint NOT NULL DEFAULT 0,
  include_tickets boolean NOT NULL DEFAULT true,
  include_diagnostics boolean NOT NULL DEFAULT true,
  route_tickets_through_n1 boolean NOT NULL DEFAULT true,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

ALTER TABLE data_lab_jobs
  ADD COLUMN IF NOT EXISTS route_tickets_through_n1 boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS data_lab_jobs_status_created_idx
  ON data_lab_jobs(status, created_at DESC);

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
  removed_at date,
  data_lab_job_id text
);

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS data_lab_job_id text;

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

CREATE INDEX IF NOT EXISTS inventory_data_lab_job_idx
  ON inventory(data_lab_job_id, serial)
  WHERE data_lab_job_id IS NOT NULL;

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'dataset'
    CHECK (source IN ('dataset', 'n1')),
  ADD COLUMN IF NOT EXISTS opened_by text,
  ADD COLUMN IF NOT EXISTS related_problem_id text,
  ADD COLUMN IF NOT EXISTS source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS noc_status text NOT NULL DEFAULT 'not_applicable'
    CHECK (noc_status IN ('not_applicable', 'pending', 'in_progress', 'linked', 'closed'));

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS ai_triage_status text NOT NULL DEFAULT 'unprocessed',
  ADD COLUMN IF NOT EXISTS ai_triage_run_id text,
  ADD COLUMN IF NOT EXISTS ai_triage_category text,
  ADD COLUMN IF NOT EXISTS ai_triage_confidence double precision,
  ADD COLUMN IF NOT EXISTS ai_triage_action text,
  ADD COLUMN IF NOT EXISTS ai_triage_reason text,
  ADD COLUMN IF NOT EXISTS ai_triage_review_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_triage_at timestamptz;

ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_ai_triage_status_check;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_ai_triage_status_check
  CHECK (ai_triage_status IN ('unprocessed', 'running', 'completed', 'needs_review', 'failed'));

ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_noc_status_check;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_noc_status_check
  CHECK (noc_status IN ('not_applicable', 'pending', 'in_progress', 'linked', 'closed'));

-- Mantém a cópia estruturada do registro de origem disponível para auditoria e
-- análises futuras. Os campos normalizados continuam sendo a superfície
-- operacional; este payload não deve ser usado para filtros de listagem.
UPDATE tickets
SET source_payload = jsonb_build_object(
  'ticket_id', ticket_id,
  'opened_at', opened_at::text,
  'customer_id', customer_id,
  'channel', channel,
  'category', category,
  'description', description,
  'resolution', resolution,
  'closed_at', closed_at::text
)
WHERE source_payload = '{}'::jsonb;

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

CREATE INDEX IF NOT EXISTS tickets_ai_triage_queue_idx
  ON tickets (ai_triage_status, opened_at ASC)
  WHERE source='n1';

CREATE TABLE IF NOT EXISTS ticket_ai_triage_runs (
  triage_id text PRIMARY KEY,
  ticket_id text NOT NULL REFERENCES tickets(ticket_id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'needs_review', 'failed')),
  observed_category text NOT NULL,
  suggested_category text,
  category_correct boolean,
  confidence double precision,
  action text NOT NULL CHECK (action IN ('keep_category', 'reclassify', 'escalate_noc', 'schedule_visit', 'close', 'review')),
  reason text NOT NULL,
  case_scope text NOT NULL DEFAULT 'uncertain' CHECK (case_scope IN ('individual', 'shared', 'uncertain')),
  noc_candidate boolean NOT NULL DEFAULT false,
  noc_reason text,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision jsonb,
  model text,
  response_id text,
  action_applied text NOT NULL DEFAULT 'none',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ticket_ai_triage_runs_ticket_created_idx
  ON ticket_ai_triage_runs (ticket_id, created_at DESC);

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

CREATE TABLE IF NOT EXISTS grouping_detection_states (
  candidate_key text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('candidate', 'cooldown', 'resolved')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  cooldown_until timestamptz,
  score integer NOT NULL,
  confidence double precision NOT NULL,
  rule_version text NOT NULL,
  score_components jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS grouping_detection_states_status_idx
  ON grouping_detection_states(status, last_seen_at DESC);

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
  wifi_rssi_avg double precision,
  provider_id text NOT NULL DEFAULT 'dataset',
  event_time timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  schema_version text NOT NULL DEFAULT '1.0',
  ingestion_key text,
  normalization_status text NOT NULL DEFAULT 'accepted'
    CHECK (normalization_status IN ('accepted', 'quarantined')),
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE informs
  ADD COLUMN IF NOT EXISTS provider_id text NOT NULL DEFAULT 'dataset',
  ADD COLUMN IF NOT EXISTS event_time timestamptz,
  ADD COLUMN IF NOT EXISTS received_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS schema_version text NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS ingestion_key text,
  ADD COLUMN IF NOT EXISTS normalization_status text NOT NULL DEFAULT 'accepted',
  ADD COLUMN IF NOT EXISTS raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE informs SET event_time=ts WHERE event_time IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS informs_provider_ingestion_key_idx
  ON informs(provider_id, ingestion_key);

CREATE INDEX IF NOT EXISTS informs_event_time_idx
  ON informs(event_time DESC, serial);

CREATE TABLE IF NOT EXISTS inform_quarantine (
  quarantine_id uuid PRIMARY KEY,
  provider_id text NOT NULL,
  serial text NOT NULL,
  event_time timestamptz NOT NULL,
  received_at timestamptz NOT NULL,
  schema_version text NOT NULL,
  ingestion_key text NOT NULL,
  reason text NOT NULL,
  raw_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inform_quarantine_received_idx
  ON inform_quarantine(received_at DESC);
