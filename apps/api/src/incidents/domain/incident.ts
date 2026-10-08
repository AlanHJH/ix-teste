export type ScopeType =
  | "park"
  | "olt"
  | "pon"
  | "cto"
  | "customer"
  | "firmware"
  | "equipment"
  | "region";

export type IncidentOptionType = Exclude<ScopeType, "park">;

export type IncidentOptionsInput = {
  type: IncidentOptionType;
  query: string;
  olt: string;
  pon: string;
  page: number;
  pageSize: number;
  sort: string;
};

export type CreateIncidentInput = {
  openedBy: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  scopeType: ScopeType;
  identifier: string;
  olt: string;
  pon: string;
  cto: string;
  probableCause: string;
  recommendedAction: string;
  originTicketId: string | null;
};

export type ProposedIncidentScope = {
  type: ScopeType | "network";
  identifier: string;
  olt: string | null;
  pon: string | null;
  cto: string | null;
};

export type ResolvedIncidentScope = {
  affected: number;
  scope: {
    type: ScopeType;
    identifier: string;
    olt: string | null;
    pon: string | null;
    cto: string | null;
  };
};
