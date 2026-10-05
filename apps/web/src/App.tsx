import { FormEvent, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Headphones,
  Network,
  RadioTower,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Users,
  Wifi,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "./api";
import type { Incident, Overview, SupportProfile } from "./types";

const number = new Intl.NumberFormat("pt-BR");
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const severityLabel = {
  critical: "Crítico",
  high: "Alto",
  medium: "Atenção",
} as const;
const scopeIcon = {
  network: Network,
  firmware: Server,
  equipment: RadioTower,
  customer: Wifi,
};

function Metric({
  icon: Icon,
  label,
  value,
  note,
  tone = "neutral",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  note: string;
  tone?: string;
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-icon">
        <Icon size={19} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function IncidentCard({ incident }: { incident: Incident }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = scopeIcon[incident.scope];
  return (
    <article className={`incident-card ${incident.severity}`}>
      <header>
        <div className="incident-title">
          <span className="scope-icon">
            <Icon size={19} />
          </span>
          <div>
            <div className="eyebrow-row">
              <span className={`severity ${incident.severity}`}>
                {severityLabel[incident.severity]}
              </span>
              <span>Confiança {incident.confidence.toLowerCase()}</span>
            </div>
            <h3>{incident.title}</h3>
            <p>{incident.location}</p>
          </div>
        </div>
        <div className="score">
          <strong>{incident.score}</strong>
          <span>prioridade</span>
        </div>
      </header>
      <div className="incident-stats">
        <div>
          <strong>{number.format(incident.affected)}</strong>
          <span>CPEs afetadas</span>
        </div>
        <div>
          <strong>{incident.signal}</strong>
          <span>Sinal dominante</span>
        </div>
        <div>
          <strong>{money.format(incident.cost)}</strong>
          <span>{incident.costLabel}</span>
        </div>
      </div>
      <div className="recommendation">
        <ArrowRight size={17} />
        <p>
          <strong>Próxima ação · {incident.owner}</strong>
          {incident.recommendation}
        </p>
      </div>
      {expanded && (
        <ul className="evidence">
          {incident.evidence.map((item) => (
            <li key={item}>
              <CheckCircle2 size={15} />
              {item}
            </li>
          ))}
        </ul>
      )}
      <button
        className="text-button"
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Ocultar evidências" : "Ver evidências"}
      </button>
    </article>
  );
}

function NocDashboard({ overview }: { overview: Overview }) {
  return (
    <>
      <section className="hero-copy">
        <div>
          <span className="section-label">
            Leitura do turno · dados até{" "}
            {new Date(`${overview.asOf}T12:00:00`).toLocaleDateString("pt-BR")}
          </span>
          <h1>{overview.readout.headline}</h1>
          <p>{overview.readout.summary}</p>
        </div>
        <div className="status-chip">
          <span className="live-dot" />
          Monitoramento ativo
        </div>
      </section>
      <section className="metrics-grid">
        <Metric
          icon={RadioTower}
          label="Parque ativo"
          value={number.format(overview.kpis.activeCpes)}
          note="CPEs em operação"
        />
        <Metric
          icon={AlertTriangle}
          label="Pressão no suporte"
          value={`+${overview.kpis.ticketGrowthPct}%`}
          note="1ª quinzena × última"
          tone="danger"
        />
        <Metric
          icon={Users}
          label="Sob risco"
          value={number.format(overview.kpis.affectedCpes)}
          note="CPEs únicas com alerta"
          tone="warning"
        />
        <Metric
          icon={RefreshCw}
          label="Reincidentes"
          value={number.format(overview.kpis.repeatCustomers)}
          note="2+ chamados em 30 dias"
        />
        <Metric
          icon={CircleDollarSign}
          label="Impacto estimado"
          value={money.format(overview.kpis.estimatedImpact)}
          note="tratamento + exposição"
          tone="money"
        />
      </section>
      <section className="dashboard-grid">
        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <span className="section-label">Sinal antecedente</span>
              <h2>Chamados técnicos por semana</h2>
            </div>
            <span className="chart-note">Lentidão, quedas e Wi‑Fi</span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={overview.weeklyTickets}
                margin={{ top: 10, right: 8, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="tickets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff8a55" stopOpacity={0.35} />
                    <stop
                      offset="100%"
                      stopColor="#ff8a55"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="#dbe5e8"
                  strokeDasharray="4 4"
                />
                <XAxis dataKey="week" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    border: "0",
                    borderRadius: 12,
                    boxShadow: "0 10px 30px rgba(7,29,43,.15)",
                  }}
                  labelFormatter={(label) => `Semana de ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Chamados"
                  stroke="#d85d2d"
                  strokeWidth={3}
                  fill="url(#tickets)"
                  dot={{ r: 3, fill: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <aside className="panel decision-panel">
          <span className="section-label">Decisão recomendada</span>
          <h2>Evite três atalhos caros</h2>
          <ol>
            <li>
              <span>01</span>
              <div>
                <strong>Não troque todos os Tuim</strong>
                <p>A taxa geral por fabricante não sustenta R$ 1,2 mi.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Não reinicie todo o parque</strong>
                <p>Reboot diário mascara a falha e cria indisponibilidade.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Não confie só no speed test</strong>
                <p>O TR‑143 não enxerga todo gargalo até o dispositivo.</p>
              </div>
            </li>
          </ol>
        </aside>
      </section>
      <section className="incidents-section">
        <div className="section-heading">
          <div>
            <span className="section-label">Fila operacional</span>
            <h2>Onde agir primeiro</h2>
          </div>
          <span>
            {overview.incidents.length} grupos ativos, ordenados por impacto
          </span>
        </div>
        <div className="incidents-list">
          {overview.incidents.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} />
          ))}
        </div>
      </section>
    </>
  );
}

const examples = [
  { id: "C545968", label: "Incidente de fibra" },
  { id: "C373254", label: "Firmware instável" },
  { id: "C171248", label: "Plano incompatível" },
];

function MetricValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="signal-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SupportDesk() {
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<SupportProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(customerId: string) {
    setLoading(true);
    setError("");
    setQuery(customerId);
    try {
      setProfile(await api.support(customerId.trim().toUpperCase()));
    } catch (reason) {
      setProfile(null);
      setError(
        reason instanceof Error ? reason.message : "Não foi possível consultar",
      );
    } finally {
      setLoading(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (query.trim()) void load(query);
  }

  return (
    <>
      <section className="support-hero">
        <span className="section-label">
          Atendimento N1 · meta de 6 minutos
        </span>
        <h1>Entenda antes de orientar.</h1>
        <p>
          Consulte pelo código do cliente. A tela cruza equipamento, rede e
          sinais recentes e entrega um roteiro explicável.
        </p>
        <form onSubmit={submit} className="search-box">
          <Search size={21} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex.: C545968"
            aria-label="Código do cliente"
          />
          <button disabled={loading}>
            {loading ? "Consultando…" : "Consultar"}
          </button>
        </form>
        <div className="examples">
          <span>Casos de demonstração:</span>
          {examples.map((item) => (
            <button key={item.id} onClick={() => void load(item.id)}>
              <strong>{item.id}</strong> · {item.label}
            </button>
          ))}
        </div>
        {error && (
          <div className="error-message">
            <AlertTriangle size={17} />
            {error}
          </div>
        )}
      </section>
      {!profile && !loading && (
        <section className="empty-support">
          <Headphones size={42} />
          <h2>Uma resposta pronta para a ligação</h2>
          <p>
            O atendente recebe a causa provável, a fala sugerida e o
            encaminhamento correto — sem interpretar telemetria bruta.
          </p>
        </section>
      )}
      {profile && (
        <section className="support-result">
          <div className="customer-strip">
            <div>
              <span>Cliente</span>
              <strong>{profile.customer.id}</strong>
              <small>
                {profile.customer.neighborhood} · {profile.customer.city}
              </small>
            </div>
            <div>
              <span>Equipamento</span>
              <strong>
                {profile.equipment.vendor} {profile.equipment.model}
              </strong>
              <small>
                {profile.equipment.serial} · fw {profile.equipment.firmware}
              </small>
            </div>
            <div>
              <span>Plano</span>
              <strong>{profile.equipment.planMbps} Mbps</strong>
              <small>
                {profile.equipment.previousPlanMbps
                  ? `upgrade de ${profile.equipment.previousPlanMbps} Mbps`
                  : "sem alteração recente"}
              </small>
            </div>
            <div>
              <span>Rede</span>
              <strong>{profile.equipment.network.split(" · ")[0]}</strong>
              <small>
                {profile.equipment.network.split(" · ").slice(1).join(" · ")}
              </small>
            </div>
          </div>
          <div className="support-layout">
            <article className={`diagnosis-card ${profile.decision.action}`}>
              <header>
                <div>
                  <span className="section-label">
                    Diagnóstico provável · confiança{" "}
                    {profile.decision.confidence.toLowerCase()}
                  </span>
                  <h2>{profile.decision.issue}</h2>
                </div>
                <ShieldCheck size={30} />
              </header>
              <div className="action-banner">
                <strong>{profile.decision.actionLabel}</strong>
              </div>
              <div className="customer-script">
                <span>O que dizer ao cliente</span>
                <blockquote>“{profile.decision.sayToCustomer}”</blockquote>
              </div>
              <div className="steps">
                <span>Durante esta ligação</span>
                <ol>
                  {profile.decision.operatorSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            </article>
            <aside className="signals-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-label">Evidências</span>
                  <h2>Últimos 7 dias</h2>
                </div>
                <Activity size={22} />
              </div>
              <div className="signals-grid">
                <MetricValue
                  label="Memória mínima"
                  value={
                    profile.metrics.mem_min_pct == null
                      ? "n/d"
                      : `${profile.metrics.mem_min_pct}%`
                  }
                />
                <MetricValue
                  label="Reinícios"
                  value={String(profile.metrics.reboot_count ?? 0)}
                />
                <MetricValue
                  label="Sinal óptico"
                  value={
                    profile.metrics.optical_rx_min_dbm == null
                      ? "n/d"
                      : `${profile.metrics.optical_rx_min_dbm} dBm`
                  }
                />
                <MetricValue
                  label="Porta LAN"
                  value={
                    profile.metrics.lan_min_mbps == null
                      ? "n/d"
                      : `${profile.metrics.lan_min_mbps} Mbps`
                  }
                />
              </div>
              <ul className="reason-list">
                {profile.decision.reasons.map((reason) => (
                  <li key={reason}>
                    <CheckCircle2 size={15} />
                    {reason}
                  </li>
                ))}
              </ul>
              {profile.metrics.diagnostic && (
                <div className="diagnostic">
                  <span>Último diagnóstico ACS</span>
                  <strong>
                    {profile.metrics.diagnostic.state === "Completed"
                      ? `${profile.metrics.diagnostic.download_mbps} Mbps`
                      : profile.metrics.diagnostic.state}
                  </strong>
                  <small>
                    {profile.metrics.diagnostic.ratio
                      ? `${Math.round(profile.metrics.diagnostic.ratio * 100)}% do plano`
                      : "sem medição válida"}
                  </small>
                </div>
              )}
            </aside>
          </div>
          {profile.recentTickets.length > 0 && (
            <div className="panel history">
              <div className="panel-heading">
                <div>
                  <span className="section-label">Contexto</span>
                  <h2>Chamados recentes</h2>
                </div>
                <Clock3 size={22} />
              </div>
              <div className="ticket-table">
                {profile.recentTickets.map((ticket) => (
                  <div key={ticket.ticket_id}>
                    <span>
                      {new Date(ticket.opened_at).toLocaleDateString("pt-BR")}
                    </span>
                    <strong>{ticket.category}</strong>
                    <p>{ticket.description}</p>
                    <small>{ticket.resolution}</small>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}

export default function App() {
  const [view, setView] = useState<"noc" | "support">("noc");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .overview()
      .then(setOverview)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Erro ao carregar"),
      );
  }, []);
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-mark">
            <RadioTower size={20} />
          </span>
          <span>
            <strong>Ondaluz</strong>
            <small>Operations intelligence</small>
          </span>
        </a>
        <nav>
          <button
            className={view === "noc" ? "active" : ""}
            onClick={() => setView("noc")}
          >
            <Activity size={17} />
            Visão NOC
          </button>
          <button
            className={view === "support" ? "active" : ""}
            onClick={() => setView("support")}
          >
            <Headphones size={17} />
            Atendimento N1
          </button>
        </nav>
        <div className="data-state">
          <span />
          <div>
            <strong>Dados carregados</strong>
            <small>
              8 semanas
              {overview
                ? ` · ${number.format(overview.kpis.activeCpes)} CPEs`
                : ""}
            </small>
          </div>
        </div>
      </header>
      <main>
        {view === "support" ? (
          <SupportDesk />
        ) : error ? (
          <div className="fatal-error">
            <AlertTriangle />
            {error}
          </div>
        ) : overview ? (
          <NocDashboard overview={overview} />
        ) : (
          <div className="loading">
            <span />
            <p>Consolidando sinais da rede…</p>
          </div>
        )}
      </main>
      <footer>
        <span>Ondaluz Ops · protótipo de decisão operacional</span>
        <span>
          As recomendações mostram evidência e confiança — a ação continua
          humana.
        </span>
      </footer>
    </div>
  );
}
