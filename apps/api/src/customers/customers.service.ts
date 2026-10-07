import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database";
import { paginate } from "../pagination";
import { CustomerSignals, decideSupport } from "./decision-engine";
import type { InventoryFilter } from "./customers.controller";

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
  category: string;
  scope: {
    type?: string;
    identifier?: string;
    olt?: string | null;
    pon?: string | null;
    cto?: string | null;
  };
  affected_cpes: number;
  confidence: number;
  probable_cause: string;
  recommended_action: string;
  opened_at: string;
  opened_by: string;
  source: "agent" | "manual";
  origin_ticket_id: string | null;
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
    pageSize: number,
    status: "active" | "removed" | "all",
    sort: string,
    filters: InventoryFilter[] = [],
  ) {
    const q = query.trim();
    const offset = (page - 1) * pageSize;
    const params: unknown[] = [q ? `%${q}%` : "", status];
    const orderBy: Record<string, string> = {
      relevance:
        "CASE WHEN customer_id ILIKE $1 OR serial ILIKE $1 THEN 0 ELSE 1 END, customer_id, status='active' DESC, installed_at DESC",
      customer_id_asc:
        "customer_id ASC, status='active' DESC, installed_at DESC",
      customer_id_desc:
        "customer_id DESC, status='active' DESC, installed_at DESC",
      serial_asc: "serial ASC, installed_at DESC",
      serial_desc: "serial DESC, installed_at DESC",
      equipment_asc: "vendor ASC, model ASC, hw_revision ASC, customer_id ASC",
      equipment_desc:
        "vendor DESC, model DESC, hw_revision DESC, customer_id ASC",
      firmware_plan_asc: "software_version ASC, plan_mbps ASC, customer_id ASC",
      firmware_plan_desc:
        "software_version DESC, plan_mbps DESC, customer_id ASC",
      installed_at_desc: "installed_at DESC, customer_id ASC",
      plan_mbps_desc: "plan_mbps DESC, customer_id ASC",
      plan_mbps_asc: "plan_mbps ASC, customer_id ASC",
      topology_asc:
        "olt ASC, pon_port ASC, cto ASC, customer_id ASC, serial ASC",
      topology_desc:
        "olt DESC, pon_port DESC, cto DESC, customer_id ASC, serial ASC",
      status_asc: "status ASC, customer_id ASC, serial ASC",
      status_desc: "status DESC, customer_id ASC, serial ASC",
    };
    const conditions = [
      `
      ($1 = '' OR customer_id ILIKE $1 OR serial ILIKE $1 OR vendor ILIKE $1
        OR model ILIKE $1 OR olt ILIKE $1 OR cto ILIKE $1 OR city ILIKE $1 OR neighborhood ILIKE $1)
      AND ($2 = 'all' OR status = $2)`,
    ];
    const columns: Record<InventoryFilter["kind"], string> = {
      customer: "customer_id",
      serial: "serial",
      vendor: "vendor",
      model: "model",
      firmware: "software_version",
      plan: "plan_mbps::text",
      olt: "olt",
      cto: "cto",
      city: "city",
      neighborhood: "neighborhood",
    };
    for (const filter of filters) {
      params.push(filter.value);
      conditions.push(`${columns[filter.kind]} = $${params.length}`);
    }
    const where = conditions.join(" AND ");
    const limitPosition = params.length + 1;
    const offsetPosition = params.length + 2;
    const [countResult, itemsResult] = await Promise.all([
      this.database.query<{ total: number }>(
        `SELECT count(*)::int AS total FROM inventory WHERE ${where}`,
        params,
      ),
      this.database.query<InventoryListRow>(
        `
        SELECT serial, customer_id, vendor, model, hw_revision, software_version,
          plan_mbps, previous_plan_mbps, plan_since::text, olt, pon_port, cto,
          city, neighborhood, status, installed_at::text, removed_at::text
        FROM inventory
        WHERE ${where}
        ORDER BY ${orderBy[sort] ?? orderBy.relevance}
        LIMIT $${limitPosition} OFFSET $${offsetPosition}`,
        [...params, pageSize, offset],
      ),
    ]);

    return paginate(
      itemsResult.rows,
      countResult.rows[0].total,
      page,
      pageSize,
    );
  }

  async filterOptions(
    query: string,
    status: "active" | "removed" | "all",
    page: number,
    pageSize: number,
    sort: string,
  ) {
    const search = query.trim().slice(0, 80);
    const result = await this.database.query<{
      kind: InventoryFilter["kind"];
      value: string;
      label: string;
      detail: string;
      count: number;
      total_items: number;
    }>(
      `WITH base AS (
         SELECT * FROM inventory WHERE ($2 = 'all' OR status = $2)
       ), options AS (
         SELECT 'customer'::text AS kind, customer_id::text AS value,
           customer_id::text AS label, min(neighborhood) || ' · ' || min(city) AS detail,
           count(*)::int AS count FROM base GROUP BY customer_id
         UNION ALL
         SELECT 'serial', serial, serial, min(vendor) || ' ' || min(model), count(*)::int
           FROM base GROUP BY serial
         UNION ALL
         SELECT 'vendor', vendor, vendor, 'Fabricante', count(*)::int
           FROM base GROUP BY vendor
         UNION ALL
         SELECT 'model', model, model, min(vendor), count(*)::int
           FROM base GROUP BY model
         UNION ALL
         SELECT 'firmware', software_version, 'fw ' || software_version,
           'Versão de firmware', count(*)::int FROM base GROUP BY software_version
         UNION ALL
         SELECT 'plan', plan_mbps::text, plan_mbps::text || ' Mbps',
           'Plano contratado', count(*)::int FROM base GROUP BY plan_mbps
         UNION ALL
         SELECT 'olt', olt, olt, 'OLT', count(*)::int FROM base GROUP BY olt
         UNION ALL
         SELECT 'cto', cto, cto, min(neighborhood) || ' · ' || min(city),
           count(*)::int FROM base GROUP BY cto
         UNION ALL
         SELECT 'city', city, city, 'Cidade', count(*)::int FROM base GROUP BY city
         UNION ALL
         SELECT 'neighborhood', neighborhood, neighborhood, min(city),
           count(*)::int FROM base GROUP BY neighborhood
       )
       SELECT kind, value, label, detail, count,
         count(*) OVER()::int AS total_items
       FROM options
       WHERE $1 = '' OR value ILIKE $1 OR label ILIKE $1 OR detail ILIKE $1
       ORDER BY ${
         sort === "label_desc"
           ? "label DESC, kind ASC"
           : sort === "label_asc"
             ? "label ASC, kind ASC"
             : `CASE
                 WHEN lower(label) = lower(trim(both '%' from $1)) THEN 0
                 WHEN lower(label) LIKE lower(trim(both '%' from $1)) || '%' THEN 1
                 WHEN label ILIKE $1 THEN 2
                 WHEN value ILIKE $1 THEN 3
                 ELSE 4 END,
               CASE kind
                 WHEN 'customer' THEN 0 WHEN 'serial' THEN 1 WHEN 'model' THEN 2
                 WHEN 'firmware' THEN 3 WHEN 'plan' THEN 4 WHEN 'olt' THEN 5
                 WHEN 'cto' THEN 6 ELSE 7 END, label`
       }
       LIMIT $3 OFFSET $4`,
      [search ? `%${search}%` : "", status, pageSize, (page - 1) * pageSize],
    );
    const totalItems = result.rows[0]?.total_items ?? 0;
    return paginate(
      result.rows.map(({ total_items: _totalItems, ...row }) => row),
      totalItems,
      page,
      pageSize,
    );
  }

  async search(
    query: string,
    page: number,
    pageSize: number,
    sort: string,
    status: "active" | "cancelled" | "all",
  ) {
    const q = query.trim();
    const search = q ? `%${q}%` : "";
    const selectedStatus = status === "all" ? "" : status;
    const orderBy: Record<string, string> = {
      customer_id_asc: "customer_id ASC",
      customer_id_desc: "customer_id DESC",
      customer_since_desc: "customer_since DESC, customer_id ASC",
      plan_mbps_desc: "plan_mbps DESC, customer_id ASC",
      plan_mbps_asc: "plan_mbps ASC, customer_id ASC",
    };
    const where = `($1='' OR customer_id ILIKE $1 OR serial ILIKE $1
        OR city ILIKE $1 OR neighborhood ILIKE $1)
      AND ($2='' OR customer_status=$2)`;
    const [countResult, result] = await Promise.all([
      this.database.query<{ total: number }>(
        `SELECT count(DISTINCT customer_id)::int AS total
         FROM inventory WHERE ${where}`,
        [search, selectedStatus],
      ),
      this.database.query<Record<string, unknown>>(
        `SELECT * FROM (
           SELECT DISTINCT ON (customer_id)
             customer_id, customer_status, customer_since::text,
             cancelled_at::text,
             CASE WHEN status='active' THEN serial END AS active_serial,
             city, neighborhood, plan_mbps
           FROM inventory
           WHERE ${where}
           ORDER BY customer_id, status='active' DESC, installed_at DESC
         ) customers
         ORDER BY ${orderBy[sort] ?? orderBy.customer_id_asc}
         LIMIT $3 OFFSET $4`,
        [search, selectedStatus, pageSize, (page - 1) * pageSize],
      ),
    ]);
    return paginate(
      result.rows,
      countResult.rows[0]?.total ?? 0,
      page,
      pageSize,
    );
  }

  async get(customerId: string) {
    const result = await this.database.query<Record<string, unknown>>(
      `SELECT customer_id, customer_status, customer_since::text,
        cancelled_at::text, serial, vendor, model, hw_revision,
        software_version, plan_mbps, previous_plan_mbps, plan_since::text,
        olt, pon_port, cto, city, neighborhood, installed_at::text,
        status, removed_at::text
       FROM inventory
       WHERE customer_id=$1
       ORDER BY status='active' DESC, installed_at DESC`,
      [customerId.trim().toUpperCase()],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Cliente não encontrado.");
    }
    const first = result.rows[0];
    return {
      customer: {
        customer_id: first.customer_id,
        customer_status: first.customer_status,
        customer_since: first.customer_since,
        cancelled_at: first.cancelled_at,
      },
      equipment_history: result.rows.map(
        ({
          customer_id,
          customer_status,
          customer_since,
          cancelled_at,
          ...equipment
        }) => equipment,
      ),
    };
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
          SELECT incident_id, title, severity, category, scope,
            affected_cpes, confidence, probable_cause, recommended_action,
            opened_at::text, opened_by, source, origin_ticket_id
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
      activeIncidents: incidentsResult.rows
        .filter((incident) => incidentMatchesEquipment(incident, equipment))
        .map((incident) => ({
          incidentId: incident.incident_id,
          title: incident.title,
          severity: incident.severity,
          category: incident.category,
          scope: incident.scope,
          affectedCpes: incident.affected_cpes,
          confidence: incident.confidence,
          probableCause: incident.probable_cause,
          recommendedAction: incident.recommended_action,
          openedAt: incident.opened_at,
          openedBy: incident.opened_by,
          source: incident.source,
          originTicketId: incident.origin_ticket_id,
        })),
      recentTickets: ticketsResult.rows,
    };
  }
}
