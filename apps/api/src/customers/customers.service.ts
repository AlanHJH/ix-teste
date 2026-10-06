import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database";
import { CustomerSignals, decideSupport } from "./decision-engine";

type InventoryRow = {
  serial: string;
  customer_id: string;
  vendor: string;
  model: string;
  hw_revision: string;
  software_version: string;
  plan_mbps: number;
  previous_plan_mbps: number | null;
  plan_since: string;
  olt: string;
  pon_port: string;
  cto: string;
  city: string;
  neighborhood: string;
};

type InventoryListRow = InventoryRow & {
  status: "active" | "removed";
  installed_at: string;
  removed_at: string | null;
};

type ActiveIncidentRow = {
  incident_id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  scope: {
    type?: string;
    identifier?: string;
    olt?: string | null;
    pon?: string | null;
    cto?: string | null;
  };
};

export function incidentMatchesEquipment(
  incident: ActiveIncidentRow,
  equipment: InventoryRow,
): boolean {
  const scope = incident.scope ?? {};
  const identifier = (scope.identifier ?? "").toLowerCase();
  if (scope.olt && scope.olt.toUpperCase() !== equipment.olt.toUpperCase()) {
    return false;
  }
  if (scope.pon && scope.pon !== equipment.pon_port) return false;
  if (scope.cto && scope.cto.toUpperCase() !== equipment.cto.toUpperCase()) {
    return false;
  }
  if (scope.olt || scope.pon || scope.cto) return true;

  switch (scope.type) {
    case "park":
      return true;
    case "olt":
      return identifier === equipment.olt.toLowerCase();
    case "pon":
    case "network":
      return (
        identifier.includes(equipment.olt.toLowerCase()) &&
        identifier.includes(equipment.pon_port.toLowerCase())
      );
    case "cto":
      return identifier.includes(equipment.cto.toLowerCase());
    case "customer":
      return [equipment.customer_id, equipment.serial]
        .map((value) => value.toLowerCase())
        .includes(identifier);
    case "firmware":
      return identifier.includes(equipment.software_version.toLowerCase());
    case "equipment":
      return [equipment.vendor, equipment.model, equipment.hw_revision].every(
        (value) => identifier.includes(value.toLowerCase()),
      );
    case "region":
      return [equipment.city, equipment.neighborhood]
        .map((value) => value.toLowerCase())
        .includes(identifier);
    default:
      return false;
  }
}

@Injectable()
export class CustomersService {
  constructor(private readonly database: DatabaseService) {}

  async list(
    query: string,
    page: number,
    limit: number,
    status: "active" | "removed" | "all",
  ) {
    const q = query.trim();
    const offset = (page - 1) * limit;
    const params = [q ? `%${q}%` : "", q ? q : "", status, limit, offset];
    const where = `
      ($1 = '' OR customer_id ILIKE $1 OR serial ILIKE $1 OR vendor ILIKE $1
        OR model ILIKE $1 OR olt ILIKE $1 OR cto ILIKE $1 OR city ILIKE $1 OR neighborhood ILIKE $1)
      AND ($3 = 'all' OR status = $3)`;
    const countWhere = `
      ($1 = '' OR customer_id ILIKE $1 OR serial ILIKE $1 OR vendor ILIKE $1
        OR model ILIKE $1 OR olt ILIKE $1 OR cto ILIKE $1 OR city ILIKE $1 OR neighborhood ILIKE $1)
      AND ($2 = 'all' OR status = $2)`;
    const [countResult, itemsResult] = await Promise.all([
      this.database.query<{ total: number }>(
        `SELECT count(*)::int AS total FROM inventory WHERE ${countWhere}`,
        [params[0], status],
      ),
      this.database.query<InventoryListRow>(
        `
        SELECT serial, customer_id, vendor, model, hw_revision, software_version,
          plan_mbps, previous_plan_mbps, plan_since::text, olt, pon_port, cto,
          city, neighborhood, status, installed_at::text, removed_at::text
        FROM inventory
        WHERE ${where}
        ORDER BY CASE WHEN customer_id ILIKE $2 OR serial ILIKE $2 THEN 0 ELSE 1 END,
          customer_id, status='active' DESC, installed_at DESC
        LIMIT $4 OFFSET $5`,
        params,
      ),
    ]);

    return {
      page,
      limit,
      total: countResult.rows[0].total,
      items: itemsResult.rows,
    };
  }

  async search(query: string) {
    const q = query.trim();
    if (q.length < 2) return [];
    const result = await this.database.query<InventoryRow>(
      `
      SELECT serial, customer_id, vendor, model, hw_revision, software_version,
        plan_mbps, previous_plan_mbps, plan_since::text, olt, pon_port, cto, city, neighborhood
      FROM inventory
      WHERE status='active' AND (customer_id ILIKE $1 OR serial ILIKE $1)
      ORDER BY CASE WHEN customer_id ILIKE $2 THEN 0 ELSE 1 END, customer_id
      LIMIT 8`,
      [`%${q}%`, `${q}%`],
    );
    return result.rows;
  }

  async getSupportProfile(customerId: string) {
    const inventoryResult = await this.database.query<InventoryRow>(
      `
      SELECT serial, customer_id, vendor, model, hw_revision, software_version,
        plan_mbps, previous_plan_mbps, plan_since::text, olt, pon_port, cto, city, neighborhood
      FROM inventory WHERE customer_id=$1 AND status='active' ORDER BY installed_at DESC LIMIT 1`,
      [customerId],
    );
    const equipment = inventoryResult.rows[0];
    if (!equipment) throw new NotFoundException("Cliente ativo não encontrado");

    const [
      metricsResult,
      diagnosticsResult,
      ticketsResult,
      incidentsResult,
      resolvedDetectedResult,
    ] = await Promise.all([
      this.database.query<{
        mem_min_pct: number | null;
        reboot_count: number;
        lan_min_mbps: number | null;
        optical_rx_min_dbm: number | null;
        optical_low_days: number;
        wifi_signal_raw: number | null;
        last_day: string;
      }>(
        `
        WITH b AS (SELECT max(day) max_day FROM daily_cpe_metrics)
        SELECT round(min(mem_min_pct)::numeric,1) AS mem_min_pct,
          sum(reboot_count)::int AS reboot_count, min(lan_min_mbps)::int AS lan_min_mbps,
          round(min(optical_rx_min_dbm)::numeric,1) AS optical_rx_min_dbm,
          count(DISTINCT day) FILTER (WHERE optical_rx_min_dbm < -27)::int AS optical_low_days,
          round(avg(wifi_signal_avg_raw)::numeric,1) AS wifi_signal_raw,
          max(day)::text AS last_day
        FROM daily_cpe_metrics, b WHERE serial=$1 AND day > b.max_day-7`,
        [equipment.serial],
      ),
      this.database.query<{
        ts: string;
        state: string;
        download_mbps: number | null;
        upload_mbps: number | null;
        ratio: number | null;
      }>(
        `
        SELECT d.ts::text, d.state, d.download_mbps, d.upload_mbps,
          round((d.download_mbps / NULLIF(i.plan_mbps,0))::numeric,3) AS ratio
        FROM diagnostics d JOIN inventory i USING(serial)
        WHERE d.serial=$1 ORDER BY d.ts DESC LIMIT 1`,
        [equipment.serial],
      ),
      this.database.query<{
        ticket_id: string;
        opened_at: string;
        category: string;
        description: string;
        resolution: string;
      }>(
        `
        SELECT ticket_id, opened_at::text, category, description, resolution
        FROM tickets WHERE customer_id=$1 ORDER BY opened_at DESC LIMIT 5`,
        [customerId],
      ),
      this.database.query<ActiveIncidentRow>(`
          SELECT incident_id, title, severity, scope
          FROM operational_incidents
          WHERE status IN ('open', 'mitigating', 'monitoring')
          ORDER BY CASE severity
            WHEN 'critical' THEN 0 WHEN 'high' THEN 1
            WHEN 'medium' THEN 2 ELSE 3 END,
            opened_at DESC
          LIMIT 100`),
      this.database.query<{ grouping_id: string }>(`
          SELECT grouping_id FROM detected_group_states
          WHERE status='resolved'`),
    ]);

    const metrics = metricsResult.rows[0];
    const diagnostic = diagnosticsResult.rows[0] ?? null;
    const signals: CustomerSignals = {
      vendor: equipment.vendor,
      model: equipment.model,
      hwRevision: equipment.hw_revision,
      softwareVersion: equipment.software_version,
      planMbps: equipment.plan_mbps,
      previousPlanMbps: equipment.previous_plan_mbps,
      olt: equipment.olt,
      ponPort: equipment.pon_port,
      memMinPct: metrics.mem_min_pct,
      rebootCount: metrics.reboot_count ?? 0,
      lanMinMbps: metrics.lan_min_mbps,
      opticalRxMinDbm: metrics.optical_rx_min_dbm,
      opticalLowDays: metrics.optical_low_days ?? 0,
      wifiSignalRaw: metrics.wifi_signal_raw,
      diagnosticRatio: diagnostic?.ratio ?? null,
    };

    const rawBaseDecision = decideSupport(signals);
    const resolvedDetectedIds = new Set(
      resolvedDetectedResult.rows.map((item) => item.grouping_id),
    );
    const baseDecision =
      rawBaseDecision.relatedProblemId &&
      resolvedDetectedIds.has(rawBaseDecision.relatedProblemId)
        ? {
            ...rawBaseDecision,
            actionLabel:
              rawBaseDecision.action === "escalar_noc"
                ? "Escalar para avaliação do NOC"
                : rawBaseDecision.actionLabel,
            relatedProblemId: null,
            relatedProblemTitle: null,
            relatedProblemKind: null,
          }
        : rawBaseDecision;
    const activeIncident = incidentsResult.rows.find((incident) =>
      incidentMatchesEquipment(incident, equipment),
    );
    const decision = activeIncident
      ? {
          ...baseDecision,
          issue: activeIncident.title,
          confidence: "Alta" as const,
          action: "escalar_noc" as const,
          actionLabel: `Vincular ao incidente ${activeIncident.incident_id}`,
          sayToCustomer:
            "Já existe um incidente confirmado pelo NOC que pode explicar este atendimento. Vou vincular seu chamado para que você acompanhe a atuação sem repetir o diagnóstico.",
          operatorSteps: [
            `Vincular o chamado ao incidente ${activeIncident.incident_id}`,
            ...baseDecision.operatorSteps,
          ],
          reasons: [
            `Incidente ativo no mesmo escopo: ${activeIncident.title}`,
            ...baseDecision.reasons,
          ],
          relatedProblemId: activeIncident.incident_id,
          relatedProblemTitle: activeIncident.title,
          relatedProblemKind: "incident" as const,
        }
      : baseDecision;

    return {
      customer: {
        id: equipment.customer_id,
        city: equipment.city,
        neighborhood: equipment.neighborhood,
      },
      equipment: {
        serial: equipment.serial,
        vendor: equipment.vendor,
        model: equipment.model,
        hardware: equipment.hw_revision,
        firmware: equipment.software_version,
        planMbps: equipment.plan_mbps,
        previousPlanMbps: equipment.previous_plan_mbps,
        planSince: equipment.plan_since,
        network: `${equipment.olt} · PON ${equipment.pon_port} · ${equipment.cto}`,
      },
      metrics: { ...metrics, diagnostic },
      decision,
      recentTickets: ticketsResult.rows,
    };
  }
}
