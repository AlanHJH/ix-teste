export const ticketCategories = ["Lentidão", "Sem conexão", "Wi-Fi"] as const;
export type TicketCategory = (typeof ticketCategories)[number];

export const ticketOutcomes = [
  "resolver_telefone",
  "escalar_noc",
  "agendar_visita",
] as const;
export type TicketOutcome = (typeof ticketOutcomes)[number];

export const ticketNocStatuses = [
  "not_applicable",
  "pending",
  "in_progress",
  "linked",
  "closed",
] as const;
export type TicketNocStatus = (typeof ticketNocStatuses)[number];

export type TicketSource = "dataset" | "n1";

export type TicketRow = {
  ticket_id: string;
  opened_at: string;
  customer_id: string;
  channel: string;
  category: string;
  description: string;
  resolution: string;
  closed_at: string | null;
  handling_minutes: number | null;
  source: TicketSource;
  opened_by: string | null;
  related_problem_id: string | null;
  noc_status: TicketNocStatus;
  city: string | null;
  neighborhood: string | null;
  olt: string | null;
  pon: string | null;
  cto: string | null;
};

export type TicketFilterKind =
  | "ticket"
  | "customer"
  | "category"
  | "resolution"
  | "channel"
  | "nocStatus"
  | "source"
  | "openedBy"
  | "olt"
  | "pon"
  | "cto";

export type TicketFilter = { kind: TicketFilterKind; value: string };

export type CreateTicketCommand = {
  customerId: string;
  openedBy: string;
  category: string;
  description: string;
  outcome: TicketOutcome;
  relatedProblemId: string | null;
};

export type PersistTicketCommand = {
  ticketId: string;
  customerId: string;
  openedBy: string;
  category: string;
  description: string;
  outcome: TicketOutcome;
  resolution: string;
  relatedProblemId: string | null;
};

export type TicketListQuery = {
  query: string;
  page: number;
  pageSize: number;
  sort: string;
  category: string;
  resolution: string;
  channel: string;
  customerId: string;
  from: string;
  to: string;
  filters: TicketFilter[];
};

export type TicketSummary = {
  total: number;
  technical: number;
  escalated: number;
  visits: number;
  avg_handling_minutes: number | null;
};

export type TicketFilterOption = {
  kind: TicketFilterKind;
  value: string;
  label: string;
  detail: string;
  count: number;
};

export type TicketListResult = {
  rows: TicketRow[];
  summary: TicketSummary;
  filters: {
    categories: string[];
    resolutions: string[];
    channels: string[];
  };
};

export type TicketNocQueueResult = {
  rows: TicketRow[];
  total: number;
  received: number;
  inProgress: number;
};

export const ticketProblemIds = new Set([
  "pon-olt2-ja",
  "firmware-kestrel-241",
  "capacity-norvik-a",
  "optical-isolated",
]);

export const ticketOutcomeResolution: Record<TicketOutcome, string> = {
  resolver_telefone: "Resolvido no atendimento",
  escalar_noc: "Escalado para NOC",
  agendar_visita: "Visita técnica agendada",
};

export function isOperationalIncidentId(value: string): boolean {
  return /^INC-[A-F0-9]{8}$/.test(value);
}

export function isKnownDetectedGrouping(value: string): boolean {
  return ticketProblemIds.has(value);
}
