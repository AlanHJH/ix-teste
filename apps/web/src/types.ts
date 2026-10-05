export type Incident = {
  id: string;
  severity: "critical" | "high" | "medium";
  scope: "firmware" | "network" | "equipment" | "customer";
  title: string;
  location: string;
  affected: number;
  score: number;
  confidence: "Alta" | "Média";
  signal: string;
  evidence: string[];
  recommendation: string;
  owner: string;
  cost: number;
  costLabel: string;
};

export type Overview = {
  asOf: string;
  kpis: {
    activeCpes: number;
    ticketGrowthPct: number;
    affectedCpes: number;
    repeatCustomers: number;
    estimatedImpact: number;
  };
  weeklyTickets: Array<{
    week: string;
    total: number;
    slowness: number;
    disconnected: number;
    wifi: number;
  }>;
  incidents: Incident[];
  readout: { headline: string; summary: string };
};

export type SupportProfile = {
  customer: { id: string; city: string; neighborhood: string };
  equipment: {
    serial: string;
    vendor: string;
    model: string;
    hardware: string;
    firmware: string;
    planMbps: number;
    previousPlanMbps: number | null;
    planSince: string;
    network: string;
  };
  metrics: {
    mem_min_pct: number | null;
    reboot_count: number;
    lan_min_mbps: number | null;
    optical_rx_min_dbm: number | null;
    optical_low_days: number;
    wifi_signal_raw: number | null;
    last_day: string;
    diagnostic: null | {
      ts: string;
      state: string;
      download_mbps: number | null;
      upload_mbps: number | null;
      ratio: number | null;
    };
  };
  decision: {
    issue: string;
    confidence: string;
    action: string;
    actionLabel: string;
    sayToCustomer: string;
    operatorSteps: string[];
    reasons: string[];
  };
  recentTickets: Array<{
    ticket_id: string;
    opened_at: string;
    category: string;
    description: string;
    resolution: string;
  }>;
};
