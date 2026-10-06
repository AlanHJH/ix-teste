export const dashboardBindings = [
  "overview.activeCpes",
  "overview.oltCount",
  "overview.ponCount",
  "overview.affectedCpes",
  "overview.repeatCustomers",
  "overview.ticketGrowthPct",
  "overview.estimatedImpact",
  "overview.weeklyTickets",
  "overview.detectedIncidents",
  "overview.executiveReadout",
  "overview.ticketMix",
  "network.topology",
  "inventory.customers",
  "inventory.equipment",
  "telemetry.dailyMetrics",
  "diagnostics.list",
  "operations.activeIncidents",
  "operations.nocQueue",
] as const;

export type DashboardBinding = (typeof dashboardBindings)[number];

export type DashboardWidgetKind =
  | "metric"
  | "timeseries"
  | "bar"
  | "pie"
  | "multiseries"
  | "alerts"
  | "queue"
  | "narrative"
  | "table"
  | "topology"
  | "map";

export type DashboardFormula = {
  operation: "sum" | "average" | "difference" | "ratio" | "percentage";
  operands: Array<
    | "overview.activeCpes"
    | "overview.oltCount"
    | "overview.ponCount"
    | "overview.affectedCpes"
    | "overview.repeatCustomers"
    | "overview.ticketGrowthPct"
    | "overview.estimatedImpact"
  >;
  decimals: 0 | 1 | 2;
  suffix: string;
};

export type DashboardWidgetConfig = {
  limit: 5 | 10 | 15;
  formula: DashboardFormula | null;
};

export type DashboardWidget = {
  id: string;
  kind: DashboardWidgetKind;
  size: "compact" | "half" | "wide";
  columns: number;
  title: string;
  description: string;
  binding: DashboardBinding;
  tone: "neutral" | "positive" | "warning" | "critical";
  config: DashboardWidgetConfig;
};

export type DashboardPlan = {
  version: "1.0";
  title: string;
  subtitle: string;
  refreshSeconds: number;
  widgets: DashboardWidget[];
};

export type DashboardComposition = DashboardPlan & {
  objective: string;
  generatedAt: string;
  generatedBy: "openai" | "fallback";
  model: string | null;
  discovery: {
    protocol: "MCP";
    mode: "openapi-bridge";
    resourceCount: number;
    endpoint: "/mcp/openapi";
    document: "/api/openapi.json";
  };
  runtimeData: {
    protocol: "REST";
    endpoints: string[];
  };
};
