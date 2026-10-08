export type DiagnosticFilterKind =
  | "serial"
  | "customer"
  | "vendor"
  | "model"
  | "state"
  | "requestedBy"
  | "diagnostic"
  | "olt"
  | "pon"
  | "cto"
  | "testServer";

export type DiagnosticFilter = {
  kind: DiagnosticFilterKind;
  value: string;
};

export type ListDiagnosticsQuery = {
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
  filters: DiagnosticFilter[];
};

export type DiagnosticRow = {
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

export type DiagnosticSummary = {
  total: number;
  completed: number;
  errors: number;
  avg_download_mbps: number | null;
  avg_upload_mbps: number | null;
};

export type DiagnosticFilterOptions = {
  kind: DiagnosticFilterKind;
  value: string;
  label: string;
  detail: string;
  count: number;
};

export type DiagnosticFacets = {
  states: string[];
  requested_by: string[];
};
