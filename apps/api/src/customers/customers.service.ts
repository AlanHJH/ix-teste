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

@Injectable()
export class CustomersService {
  constructor(private readonly database: DatabaseService) {}

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

    const [metricsResult, diagnosticsResult, ticketsResult] = await Promise.all(
      [
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
      ],
    );

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
      decision: decideSupport(signals),
      recentTickets: ticketsResult.rows,
    };
  }
}
