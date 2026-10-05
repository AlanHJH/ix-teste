import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database';

type WeeklyTicket = {
  week: string;
  total: number;
  slowness: number;
  disconnected: number;
  wifi: number;
};

type Incident = {
  id: string;
  severity: 'critical' | 'high' | 'medium';
  scope: 'firmware' | 'network' | 'equipment' | 'customer';
  title: string;
  location: string;
  affected: number;
  score: number;
  confidence: 'Alta' | 'Média';
  signal: string;
  evidence: string[];
  recommendation: string;
  owner: string;
  cost: number;
  costLabel: string;
};

@Injectable()
export class NetworkService {
  constructor(private readonly database: DatabaseService) {}

  async getOverview() {
    const [weeklyResult, activeResult, latestResult, repeatResult, affectedResult] = await Promise.all([
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
      this.database.query<{ active: number }>("SELECT count(*)::int AS active FROM inventory WHERE status='active'"),
      this.database.query<{ day: string }>('SELECT max(day)::text AS day FROM daily_cpe_metrics'),
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
        SELECT count(*)::int AS affected FROM affected`)
    ]);

    const weekly = weeklyResult.rows;
    const firstTwo = weekly.slice(0, 2).reduce((sum, week) => sum + week.total, 0) / 2;
    const lastTwo = weekly.slice(-2).reduce((sum, week) => sum + week.total, 0) / 2;
    const ticketGrowthPct = Math.round(((lastTwo - firstTwo) / firstTwo) * 100);
    const incidents = await this.getIncidents();
    return {
      asOf: latestResult.rows[0].day,
      kpis: {
        activeCpes: activeResult.rows[0].active,
        ticketGrowthPct,
        affectedCpes: affectedResult.rows[0].affected,
        repeatCustomers: repeatResult.rows[0].repeaters,
        estimatedImpact: incidents.reduce((sum, incident) => sum + incident.cost, 0)
      },
      weeklyTickets: weekly,
      incidents,
      readout: {
        headline: 'O aumento não tem uma causa única — há três ações diferentes.',
        summary: 'Priorize a fibra compartilhada no Jardim Aurora, contenha o firmware Kestrel 2.4.1 e corrija a incompatibilidade do Turbo 500. Trocar todos os Tuim não é sustentado pelos dados.'
      }
    };
  }

  async getIncidents(): Promise<Incident[]> {
    const [firmware, network, capacity, optical] = await Promise.all([
      this.database.query<{ affected: number; reboots: number; min_memory: number; tickets: number; escalations: number }>(`
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
      this.database.query<{ affected: number; fec_errors: number; tickets: number; visits: number; escalations: number }>(`
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
      this.database.query<{ affected: number; tickets: number; escalations: number }>(`
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
      this.database.query<{ affected: number; tickets: number; visits: number }>(`
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
        LEFT JOIN tickets t ON t.customer_id=a.customer_id AND t.opened_at >= (SELECT max(opened_at)-interval '14 days' FROM tickets)`)
    ]);

    const fw = firmware.rows[0];
    const net = network.rows[0];
    const cap = capacity.rows[0];
    const opt = optical.rows[0];
    return [
      {
        id: 'pon-olt2-ja', severity: 'critical', scope: 'network', score: 98,
        title: 'Degradação coletiva na fibra', location: 'OLT-2 · PON 1/7 e 1/8 · Jardim Aurora',
        affected: net.affected, confidence: 'Alta', signal: `${net.fec_errors.toLocaleString('pt-BR')} erros FEC em 7 dias`,
        evidence: [`${net.tickets} chamados recentes no grupo`, `${net.visits} visitas e ${net.escalations} escalonamentos recentes`, 'As duas portas compartilham o alimentador CE-JA-03'],
        recommendation: 'Acionar rede externa para inspeção do alimentador/CE-JA-03. Suspender visitas residenciais isoladas até validar o trecho comum.',
        owner: 'Rede externa', cost: net.tickets * 18 + net.visits * 120 + net.escalations * 25, costLabel: 'custo recente de tratamento'
      },
      {
        id: 'firmware-kestrel-241', severity: 'critical', scope: 'firmware', score: 94,
        title: 'Instabilidade no Kestrel 2.4.1', location: 'Parque KX-3000 atualizado em 20–24/07',
        affected: fw.affected, confidence: 'Alta', signal: `memória livre chegou a ${fw.min_memory}%`,
        evidence: [`${fw.reboots.toLocaleString('pt-BR')} boots na última semana`, `${fw.tickets} chamados recentes entre afetados`, 'A degradação começa após a janela de atualização do lote 1'],
        recommendation: 'Congelar o rollout, abrir chamado com evidências e executar rollback canário para 2.3.8 antes de ampliar.',
        owner: 'NOC + fornecedor', cost: fw.tickets * 18 + fw.escalations * 25, costLabel: 'suporte e NOC recentes'
      },
      {
        id: 'capacity-norvik-a', severity: 'high', scope: 'equipment', score: 86,
        title: 'Turbo 500 limitado a 100 Mbps', location: 'Norvik NV-G1 revisão A · clientes com upgrade',
        affected: cap.affected, confidence: 'Alta', signal: 'porta LAN negocia permanentemente em 100 Mbps',
        evidence: [`${cap.tickets} chamados de lentidão após o upgrade`, `${cap.escalations} escalonamentos ao NOC`, 'O teste TR-143 pode medir a CPE e mascarar o gargalo LAN do cliente'],
        recommendation: 'Bloquear novos upgrades nesse hardware; contatar os clientes afetados e trocar equipamento com agenda priorizada.',
        owner: 'Comercial + campo', cost: cap.affected * 530, costLabel: 'exposição para troca completa'
      },
      {
        id: 'optical-isolated', severity: 'medium', scope: 'customer', score: 62,
        title: 'Sinal óptico fora da especificação', location: 'Clientes isolados fora do cluster do Jardim Aurora',
        affected: opt.affected, confidence: 'Média', signal: 'Rx abaixo de -27 dBm em pelo menos 2 de 3 dias',
        evidence: [`${opt.tickets} chamados recentes`, `${opt.visits} visitas já agendadas`, 'Casos distribuídos sem concentração comum evidente'],
        recommendation: 'Validar conector/drop e agendar visita apenas para os seriais que mantiverem Rx fora da faixa.',
        owner: 'Campo', cost: opt.affected * 120, costLabel: 'exposição de visitas'
      }
    ];
  }
}
