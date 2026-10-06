import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../database";

type WeeklyTicket = {
  week: string;
  total: number;
  slowness: number;
  disconnected: number;
  wifi: number;
};

type Incident = {
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

const detectedGroupingIds = new Set([
  "pon-olt2-ja",
  "firmware-kestrel-241",
  "capacity-norvik-a",
  "optical-isolated",
]);

@Injectable()
export class NetworkService {
  constructor(private readonly database: DatabaseService) {}

  async getTopology(olt?: string, pon?: string) {
    const selectedOlt = olt?.trim().toUpperCase() || null;
    const selectedPon = pon?.trim() || null;
    const [totalsResult, oltsResult] = await Promise.all([
      this.database.query<{
        cpes: number;
        olts: number;
        pons: number;
        ctos: number;
      }>(`
        SELECT count(*)::int AS cpes,
          count(DISTINCT olt)::int AS olts,
          count(DISTINCT (olt, pon_port))::int AS pons,
          count(DISTINCT cto)::int AS ctos
        FROM inventory WHERE status='active'`),
      this.database.query<{
        olt: string;
        cpes: number;
        pons: number;
        ctos: number;
        cities: string[];
        neighborhoods: string[];
      }>(`
        SELECT olt, count(*)::int AS cpes,
          count(DISTINCT pon_port)::int AS pons,
          count(DISTINCT cto)::int AS ctos,
          array_agg(DISTINCT city ORDER BY city) AS cities,
          array_agg(DISTINCT neighborhood ORDER BY neighborhood) AS neighborhoods
        FROM inventory
        WHERE status='active'
        GROUP BY olt ORDER BY olt`),
    ]);

    const ponsResult = selectedOlt
      ? await this.database.query<{
          pon: string;
          cpes: number;
          ctos: number;
        }>(
          `
          SELECT pon_port AS pon, count(*)::int AS cpes,
            count(DISTINCT cto)::int AS ctos
          FROM inventory
          WHERE status='active' AND olt=$1
          GROUP BY pon_port
          ORDER BY split_part(pon_port, '/', 1)::int, split_part(pon_port, '/', 2)::int`,
          [selectedOlt],
        )
      : { rows: [] };

    const ctosResult =
      selectedOlt && selectedPon
        ? await this.database.query<{
            cto: string;
            cpes: number;
            city: string;
            neighborhood: string;
          }>(
            `
          SELECT cto, count(*)::int AS cpes,
            min(city) AS city, min(neighborhood) AS neighborhood
          FROM inventory
          WHERE status='active' AND olt=$1 AND pon_port=$2
          GROUP BY cto
          ORDER BY cto`,
            [selectedOlt, selectedPon],
          )
        : { rows: [] };

    return {
      totals: totalsResult.rows[0],
      olts: oltsResult.rows,
      pons: ponsResult.rows,
      ctos: ctosResult.rows,
      selected: { olt: selectedOlt, pon: selectedPon },
      limitations: {
        hasCableIds: false,
        hasDropIds: false,
        hasLogicalDropIds: true,
        message:
          "Cada CPE ativa recebeu um ID de drop lógico, derivado do serial e marcado como estimado. O dataset ainda não fornece IDs físicos de cabo, splitter ou drop.",
      },
    };
  }

  async findTopologyPath(query: string) {
    const value = query.trim();
    if (value.length < 2) return [];
    const result = await this.database.query<{
      serial: string;
      customer_id: string;
      vendor: string;
      model: string;
      hw_revision: string;
      software_version: string;
      plan_mbps: number;
      olt: string;
      pon: string;
      cto: string;
      city: string;
      neighborhood: string;
      logical_drop_id: string | null;
    }>(
      `
      SELECT i.serial, i.customer_id, i.vendor, i.model, i.hw_revision, i.software_version,
        i.plan_mbps, i.olt, i.pon_port AS pon, i.cto, i.city, i.neighborhood,
        d.drop_id AS logical_drop_id
      FROM inventory i
      LEFT JOIN generated_logical_drops d USING(serial)
      WHERE i.status='active' AND (i.customer_id ILIKE $1 OR i.serial ILIKE $1)
      ORDER BY CASE WHEN i.customer_id ILIKE $2 OR i.serial ILIKE $2 THEN 0 ELSE 1 END,
        i.customer_id, i.serial
      LIMIT 8`,
      [`%${value}%`, value],
    );
    return result.rows;
  }

  async getTopologyDevices(olt: string, pon: string, cto: string) {
    if (!olt.trim() || !pon.trim() || !cto.trim()) return [];
    const result = await this.database.query<{
      serial: string;
      customer_id: string;
      vendor: string;
      model: string;
      hw_revision: string;
      software_version: string;
      plan_mbps: number;
      olt: string;
      pon: string;
      cto: string;
      city: string;
      neighborhood: string;
      logical_drop_id: string | null;
    }>(
      `
      SELECT i.serial, i.customer_id, i.vendor, i.model, i.hw_revision, i.software_version,
        i.plan_mbps, i.olt, i.pon_port AS pon, i.cto, i.city, i.neighborhood,
        d.drop_id AS logical_drop_id
      FROM inventory i
      LEFT JOIN generated_logical_drops d USING(serial)
      WHERE i.status='active' AND i.olt=$1 AND i.pon_port=$2 AND i.cto=$3
      ORDER BY i.customer_id, i.serial`,
      [olt.trim().toUpperCase(), pon.trim(), cto.trim().toUpperCase()],
    );
    return result.rows;
  }

  async getOverview() {
    const [
      weeklyResult,
      activeResult,
      latestResult,
      repeatResult,
      affectedResult,
    ] = await Promise.all([
      this.database.query<WeeklyTicket>(`
        SELECT to_char(date_trunc('week', opened_at AT TIME ZONE 'America/Sao_Paulo'), 'DD/MM') AS week,
          count(*)::int AS total,
          count(*) FILTER (WHERE category='Lentidão')::int AS slowness,
          count(*) FILTER (WHERE category='Sem conexão')::int AS disconnected,
          count(*) FILTER (WHERE category='Wi-Fi')::int AS wifi
        FROM tickets
        WHERE category IN ('Lentidão','Sem conexão','Wi-Fi')
        GROUP BY date_trunc('week', opened_at AT TIME ZONE 'America/Sao_Paulo')
        ORDER BY date_trunc('week', opened_at AT TIME ZONE 'America/Sao_Paulo')`),
      this.database.query<{ active: number }>(
        "SELECT count(*)::int AS active FROM inventory WHERE status='active'",
      ),
      this.database.query<{ day: string }>(
        "SELECT max(day)::text AS day FROM daily_cpe_metrics",
      ),
      this.database.query<{ repeaters: number }>(`
        WITH limits AS (SELECT max(opened_at) AS max_ts FROM tickets), repeated AS (
          SELECT customer_id FROM tickets, limits
          WHERE opened_at >= max_ts - interval '30 days'
            AND category IN ('Lentidão','Sem conexão','Wi-Fi')
          GROUP BY customer_id HAVING count(*) >= 2
        ) SELECT count(*)::int AS repeaters FROM repeated`),
      this.database.query<{ affected: number }>(`
        WITH b AS (SELECT max(day) max_day FROM daily_cpe_metrics),
        firmware AS (
          SELECT DISTINCT m.serial
          FROM daily_cpe_metrics m JOIN inventory i USING(serial), b
          WHERE m.day > b.max_day - 7 AND m.software_version='2.4.1'
            AND i.status='active' AND (m.mem_min_pct < 10 OR m.reboot_count >= 2)
        ), network AS (
          SELECT DISTINCT m.serial
          FROM daily_cpe_metrics m JOIN inventory i USING(serial), b
          WHERE m.day > b.max_day - 7 AND m.olt='OLT-2' AND m.pon_port IN ('1/7','1/8')
            AND i.status='active'
        ), capacity AS (
          SELECT serial FROM inventory
          WHERE status='active' AND vendor='Norvik' AND hw_revision='A'
            AND previous_plan_mbps IS NOT NULL AND plan_mbps > 100
            AND plan_since >= DATE '2026-07-13'
        ), optical AS (
          SELECT m.serial
          FROM daily_cpe_metrics m JOIN inventory i USING(serial), b
          WHERE m.day > b.max_day - 3 AND i.status='active'
            AND NOT (m.olt='OLT-2' AND m.pon_port IN ('1/7','1/8'))
          GROUP BY m.serial
          HAVING count(DISTINCT m.day) FILTER (WHERE m.optical_rx_min_dbm < -27) >= 2
        ), affected AS (
          SELECT serial FROM firmware UNION SELECT serial FROM network
          UNION SELECT serial FROM capacity UNION SELECT serial FROM optical
        )
        SELECT count(*)::int AS affected FROM affected`),
    ]);

    const weekly = weeklyResult.rows;
    const firstTwo =
      weekly.slice(0, 2).reduce((sum, week) => sum + week.total, 0) / 2;
    const lastTwo =
      weekly.slice(-2).reduce((sum, week) => sum + week.total, 0) / 2;
    const ticketGrowthPct = Math.round(((lastTwo - firstTwo) / firstTwo) * 100);
    const incidents = await this.getIncidents();
    return {
      asOf: latestResult.rows[0].day,
      kpis: {
        activeCpes: activeResult.rows[0].active,
        ticketGrowthPct,
        affectedCpes: affectedResult.rows[0].affected,
        repeatCustomers: repeatResult.rows[0].repeaters,
        estimatedImpact: incidents.reduce(
          (sum, incident) => sum + incident.cost,
          0,
        ),
      },
      weeklyTickets: weekly,
      incidents,
      readout: {
        headline:
          "O aumento não tem uma causa única — há três ações diferentes.",
        summary:
          "Priorize a fibra compartilhada no Jardim Aurora, contenha o firmware Kestrel 2.4.1 e corrija a incompatibilidade do Turbo 500. Trocar todos os Tuim não é sustentado pelos dados.",
      },
    };
  }

  async getIncidents(): Promise<Incident[]> {
    const [firmware, network, capacity, optical] = await Promise.all([
      this.database.query<{
        affected: number;
        reboots: number;
        min_memory: number;
        tickets: number;
        escalations: number;
      }>(`
        WITH b AS (SELECT max(day) max_day FROM daily_cpe_metrics), affected AS (
          SELECT DISTINCT m.serial, m.customer_id
          FROM daily_cpe_metrics m JOIN inventory inv USING(serial), b
          WHERE m.day > b.max_day - 7 AND m.software_version='2.4.1'
            AND inv.status='active'
            AND (m.mem_min_pct < 10 OR m.reboot_count >= 2)
        )
        SELECT count(DISTINCT a.serial)::int AS affected,
          (SELECT coalesce(sum(m.reboot_count),0)::int
             FROM daily_cpe_metrics m JOIN inventory i USING(serial), b
            WHERE m.day > b.max_day - 7 AND m.software_version='2.4.1' AND i.status='active') AS reboots,
          (SELECT round(min(m.mem_min_pct)::numeric,1)
             FROM daily_cpe_metrics m JOIN inventory i USING(serial), b
            WHERE m.day > b.max_day - 7 AND m.software_version='2.4.1' AND i.status='active') AS min_memory,
          count(t.ticket_id)::int AS tickets,
          count(t.ticket_id) FILTER (WHERE t.resolution='Escalado para NOC')::int AS escalations
        FROM affected a
        LEFT JOIN tickets t ON t.customer_id=a.customer_id AND t.opened_at >= (SELECT max(opened_at)-interval '14 days' FROM tickets)`),
      this.database.query<{
        affected: number;
        fec_errors: number;
        tickets: number;
        visits: number;
        escalations: number;
      }>(`
        WITH b AS (SELECT max(day) max_day FROM daily_cpe_metrics), affected AS (
          SELECT DISTINCT m.serial, m.customer_id FROM daily_cpe_metrics m JOIN inventory inv USING(serial), b
          WHERE m.day > b.max_day - 7 AND m.olt='OLT-2' AND m.pon_port IN ('1/7','1/8') AND inv.status='active'
        )
        SELECT count(DISTINCT a.serial)::int AS affected,
          (SELECT coalesce(sum(m.fec_errors),0)
             FROM daily_cpe_metrics m JOIN inventory i USING(serial), b
            WHERE m.day > b.max_day-7 AND m.olt='OLT-2' AND m.pon_port IN ('1/7','1/8')
              AND i.status='active') AS fec_errors,
          count(t.ticket_id)::int AS tickets,
          count(t.ticket_id) FILTER (WHERE t.resolution='Visita técnica agendada')::int AS visits,
          count(t.ticket_id) FILTER (WHERE t.resolution='Escalado para NOC')::int AS escalations
        FROM affected a
        LEFT JOIN tickets t ON t.customer_id=a.customer_id AND t.opened_at >= (SELECT max(opened_at)-interval '14 days' FROM tickets)`),
      this.database.query<{
        affected: number;
        tickets: number;
        escalations: number;
      }>(`
        SELECT count(DISTINCT i.serial)::int AS affected,
          count(t.ticket_id)::int AS tickets,
          count(t.ticket_id) FILTER (WHERE t.resolution='Escalado para NOC')::int AS escalations
        FROM inventory i
        LEFT JOIN tickets t ON t.customer_id=i.customer_id
          AND t.opened_at::date >= i.plan_since
          AND t.category='Lentidão'
        WHERE i.status='active' AND i.vendor='Norvik' AND i.hw_revision='A'
          AND i.previous_plan_mbps IS NOT NULL AND i.plan_mbps > 100
          AND i.plan_since >= DATE '2026-07-13'`),
      this.database.query<{
        affected: number;
        tickets: number;
        visits: number;
      }>(`
        WITH b AS (SELECT max(day) max_day FROM daily_cpe_metrics), affected AS (
          SELECT m.serial, max(m.customer_id) AS customer_id
          FROM daily_cpe_metrics m JOIN inventory inv USING(serial), b
          WHERE m.day > b.max_day - 3 AND inv.status='active'
            AND NOT (m.olt='OLT-2' AND m.pon_port IN ('1/7','1/8'))
          GROUP BY m.serial
          HAVING count(DISTINCT m.day) FILTER (WHERE m.optical_rx_min_dbm < -27) >= 2
        )
        SELECT count(DISTINCT a.serial)::int AS affected,
          count(t.ticket_id)::int AS tickets,
          count(t.ticket_id) FILTER (WHERE t.resolution='Visita técnica agendada')::int AS visits
        FROM affected a
        LEFT JOIN tickets t ON t.customer_id=a.customer_id AND t.opened_at >= (SELECT max(opened_at)-interval '14 days' FROM tickets)`),
    ]);

    const fw = firmware.rows[0];
    const net = network.rows[0];
    const cap = capacity.rows[0];
    const opt = optical.rows[0];
    const detectedGroups: Incident[] = [
      {
        id: "pon-olt2-ja",
        severity: "critical",
        scope: "network",
        score: 98,
        title: "Degradação coletiva na fibra",
        location: "OLT-2 · PON 1/7 e 1/8 · Jardim Aurora",
        affected: net.affected,
        confidence: "Alta",
        signal: `${net.fec_errors.toLocaleString("pt-BR")} erros FEC em 7 dias`,
        evidence: [
          `${net.tickets} chamados recentes no grupo`,
          `${net.visits} visitas e ${net.escalations} escalonamentos recentes`,
          "As duas portas compartilham o alimentador CE-JA-03",
        ],
        recommendation:
          "Acionar rede externa para inspeção do alimentador/CE-JA-03. Suspender visitas residenciais isoladas até validar o trecho comum.",
        owner: "Rede externa",
        cost: net.tickets * 18 + net.visits * 120 + net.escalations * 25,
        costLabel: "custo recente de tratamento",
      },
      {
        id: "firmware-kestrel-241",
        severity: "critical",
        scope: "firmware",
        score: 94,
        title: "Instabilidade no Kestrel 2.4.1",
        location: "Parque KX-3000 atualizado em 20–24/07",
        affected: fw.affected,
        confidence: "Alta",
        signal: `memória livre chegou a ${fw.min_memory}%`,
        evidence: [
          `${fw.reboots.toLocaleString("pt-BR")} boots na última semana`,
          `${fw.tickets} chamados recentes entre afetados`,
          "A degradação começa após a janela de atualização do lote 1",
        ],
        recommendation:
          "Congelar o rollout, abrir chamado com evidências e executar rollback canário para 2.3.8 antes de ampliar.",
        owner: "NOC + fornecedor",
        cost: fw.tickets * 18 + fw.escalations * 25,
        costLabel: "suporte e NOC recentes",
      },
      {
        id: "capacity-norvik-a",
        severity: "high",
        scope: "equipment",
        score: 86,
        title: "Turbo 500 limitado a 100 Mbps",
        location: "Norvik NV-G1 revisão A · clientes com upgrade",
        affected: cap.affected,
        confidence: "Alta",
        signal: "porta LAN negocia permanentemente em 100 Mbps",
        evidence: [
          `${cap.tickets} chamados de lentidão após o upgrade`,
          `${cap.escalations} escalonamentos ao NOC`,
          "O teste TR-143 pode medir a CPE e mascarar o gargalo LAN do cliente",
        ],
        recommendation:
          "Bloquear novos upgrades nesse hardware; contatar os clientes afetados e trocar equipamento com agenda priorizada.",
        owner: "Comercial + campo",
        cost: cap.affected * 530,
        costLabel: "exposição para troca completa",
      },
      {
        id: "optical-isolated",
        severity: "medium",
        scope: "customer",
        score: 62,
        title: "Sinal óptico fora da especificação",
        location: "Clientes isolados fora do cluster do Jardim Aurora",
        affected: opt.affected,
        confidence: "Média",
        signal: "Rx abaixo de -27 dBm em pelo menos 2 de 3 dias",
        evidence: [
          `${opt.tickets} chamados recentes`,
          `${opt.visits} visitas já agendadas`,
          "Casos distribuídos sem concentração comum evidente",
        ],
        recommendation:
          "Validar conector/drop e agendar visita apenas para os seriais que mantiverem Rx fora da faixa.",
        owner: "Campo",
        cost: opt.affected * 120,
        costLabel: "exposição de visitas",
      },
    ];
    const resolvedResult = await this.database.query<{ grouping_id: string }>(`
      SELECT grouping_id FROM detected_group_states WHERE status='resolved'`);
    const resolvedIds = new Set(
      resolvedResult.rows.map((item) => item.grouping_id),
    );
    return detectedGroups.filter((grouping) => !resolvedIds.has(grouping.id));
  }

  async closeDetectedGrouping(groupingId: string, status: "resolved") {
    if (status !== "resolved") {
      throw new BadRequestException("Encerramento de agrupamento inválido.");
    }
    const normalizedId = groupingId.trim().toLowerCase();
    if (!detectedGroupingIds.has(normalizedId)) {
      throw new NotFoundException("Agrupamento não encontrado.");
    }
    const result = await this.database.query<{
      grouping_id: string;
      status: "resolved";
    }>(
      `INSERT INTO detected_group_states(grouping_id, status, resolved_at)
       VALUES ($1, 'resolved', now())
       ON CONFLICT (grouping_id) DO UPDATE
         SET status='resolved', resolved_at=now()
       RETURNING grouping_id, status`,
      [normalizedId],
    );
    return result.rows[0];
  }
}
