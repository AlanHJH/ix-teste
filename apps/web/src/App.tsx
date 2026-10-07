import { FormEvent, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Gauge,
  GitBranch,
  Headphones,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  RadioTower,
  RefreshCw,
  Search,
  ShieldCheck,
  Settings2,
  TicketCheck,
  TicketPlus,
  Users,
  X,
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
import { HelpTooltip } from "./HelpTooltip";
import { providerGlossary, TechnicalText } from "./ProviderGlossary";
import { InventoryDirectory } from "./InventoryDirectory";
import { TopologyMap } from "./TopologyMap";
import { SupportTickets } from "./SupportTickets";
import { DiagnosticsDirectory } from "./DiagnosticsDirectory";
import { InvestigationReview } from "./InvestigationReview";
import { NocOperations } from "./NocOperations";
import { AgentConfiguration } from "./AgentConfiguration";
import { N1AdvisorChat } from "./N1AdvisorChat";
import { DynamicDashboard } from "./DynamicDashboard";
import {
  groupingAgentEnabled,
  n1GuidanceEnabled,
  useAgentPolicy,
} from "./agentPolicy";
import {
  canAccessView,
  clearSession,
  defaultViewFor,
  demoUsers,
  loadSession,
  saveSession,
} from "./auth";
import type { AppView, DemoUser } from "./auth";
import type { Overview, SupportProfile, TicketFilter } from "./types";

const number = new Intl.NumberFormat("pt-BR");
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

type View = AppView;

function Metric({
  icon: Icon,
  label,
  value,
  note,
  help,
  tone = "neutral",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  note: string;
  help?: string;
  tone?: string;
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-icon">
        <Icon size={19} />
      </div>
      <div>
        <span>
          {label}
          {help && <HelpTooltip term={label} description={help} />}
        </span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function ExecutiveDashboard({ overview }: { overview: Overview }) {
  return (
    <section className="executive-dashboard">
      <header className="dashboard-hero">
        <div>
          <span className="section-label">Visão consolidada</span>
          <h1>Dashboard</h1>
          <p>Indicadores gerais do parque e evolução da demanda de suporte.</p>
        </div>
        <LayoutDashboard size={28} />
      </header>
      <section className="metrics-grid">
        <Metric
          icon={RadioTower}
          label="Parque ativo"
          value={number.format(overview.kpis.activeCpes)}
          note="CPEs em operação"
          help={providerGlossary.cpe.description}
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
          help={`${providerGlossary.cpe.description} A contagem não duplica o mesmo equipamento em vários alertas.`}
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
      </section>
    </section>
  );
}

function NocDashboard({
  nocTicketCount,
  onOpenNocTickets,
}: {
  nocTicketCount: number;
  onOpenNocTickets: () => void;
}) {
  return (
    <NocOperations
      nocTicketCount={nocTicketCount}
      onOpenNocTickets={onOpenNocTickets}
    />
  );
}

const examples = [
  { id: "C545968", label: "Agrupamento de fibra" },
  { id: "C373254", label: "Firmware instável" },
  { id: "C171248", label: "Plano incompatível" },
  { id: "C361578", label: "Resolver por telefone" },
];

function MetricValue({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help?: string;
}) {
  return (
    <div className="signal-value">
      <span>
        {label}
        {help && <HelpTooltip term={label} description={help} />}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function SupportDesk({ initialCustomer }: { initialCustomer?: string }) {
  const agentPolicy = useAgentPolicy();
  const showN1Advisor = n1GuidanceEnabled(agentPolicy);
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<SupportProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ticketOpenedBy, setTicketOpenedBy] = useState("");
  const [ticketCategory, setTicketCategory] = useState("Lentidão");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketOutcome, setTicketOutcome] = useState<
    "resolver_telefone" | "escalar_noc" | "agendar_visita"
  >("escalar_noc");
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketError, setTicketError] = useState("");
  const [createdTicket, setCreatedTicket] = useState("");

  function suggestedCategory(issue: string) {
    const normalized = issue.toLocaleLowerCase("pt-BR");
    if (normalized.includes("wi-fi")) return "Wi-Fi";
    if (normalized.includes("fibra") || normalized.includes("sinal óptico")) {
      return "Sem conexão";
    }
    return "Lentidão";
  }

  async function load(customerId: string) {
    setLoading(true);
    setError("");
    setQuery(customerId);
    try {
      const nextProfile = await api.support(customerId.trim().toUpperCase());
      setProfile(nextProfile);
      setTicketCategory(suggestedCategory(nextProfile.decision.issue));
      setTicketDescription(nextProfile.decision.issue);
      setTicketOutcome(nextProfile.decision.action);
      setTicketError("");
      setCreatedTicket("");
    } catch (reason) {
      setProfile(null);
      setError(
        reason instanceof Error ? reason.message : "Não foi possível consultar",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (initialCustomer) void load(initialCustomer);
  }, [initialCustomer]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (query.trim()) void load(query);
  }

  async function createTicket(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setTicketBusy(true);
    setTicketError("");
    setCreatedTicket("");
    try {
      const ticket = await api.createTicket({
        customerId: profile.customer.id,
        openedBy: ticketOpenedBy,
        category: ticketCategory,
        description: ticketDescription,
        outcome: ticketOutcome,
        relatedProblemId: profile.decision.relatedProblemId,
      });
      setCreatedTicket(ticket.ticket_id);
      setProfile(await api.support(profile.customer.id));
    } catch (reason) {
      setTicketError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível abrir o chamado",
      );
    } finally {
      setTicketBusy(false);
    }
  }

  return (
    <>
      <section className="support-hero">
        <span className="section-label">
          Atendimento N1 · meta de 6 minutos
          <HelpTooltip
            term="Atendimento N1"
            description="Primeiro nível de suporte: confirma dados, interpreta sinais e orienta o cliente antes de escalar o caso."
          />
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
            encaminhamento correto — sem interpretar{" "}
            <TechnicalText text="telemetria" /> bruta.
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
                {profile.equipment.serial} ·{" "}
                <TechnicalText text={`fw ${profile.equipment.firmware}`} />
              </small>
            </div>
            <div>
              <span>Plano</span>
              <strong>
                <TechnicalText text={`${profile.equipment.planMbps} Mbps`} />
              </strong>
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
                  <h2>
                    <TechnicalText text={profile.decision.issue} />
                  </h2>
                </div>
                <ShieldCheck size={30} />
              </header>
              <div className="action-banner">
                <strong>
                  <TechnicalText text={profile.decision.actionLabel} />
                </strong>
              </div>
              <div className="customer-script">
                <span>O que dizer ao cliente</span>
                <blockquote>“{profile.decision.sayToCustomer}”</blockquote>
              </div>
              <div className="steps">
                <span>Durante esta ligação</span>
                <ol>
                  {profile.decision.operatorSteps.map((step) => (
                    <li key={step}>
                      <TechnicalText text={step} />
                    </li>
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
                  help={`Menor percentual de memória livre registrado na CPE nos últimos sete dias. ${providerGlossary.cpe.description}`}
                  value={
                    profile.metrics.mem_min_pct == null
                      ? "n/d"
                      : `${profile.metrics.mem_min_pct}%`
                  }
                />
                <MetricValue
                  label="Reinícios"
                  help={providerGlossary.reboot.description}
                  value={String(profile.metrics.reboot_count ?? 0)}
                />
                <MetricValue
                  label="Sinal óptico"
                  help={`${providerGlossary.opticalSignal.description} ${providerGlossary.dbm.description}`}
                  value={
                    profile.metrics.optical_rx_min_dbm == null
                      ? "n/d"
                      : `${profile.metrics.optical_rx_min_dbm} dBm`
                  }
                />
                <MetricValue
                  label="Porta LAN"
                  help={`${providerGlossary.lan.description} ${providerGlossary.mbps.description}`}
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
                    <TechnicalText text={reason} />
                  </li>
                ))}
              </ul>
              {profile.metrics.diagnostic && (
                <div className="diagnostic">
                  <span>
                    Último diagnóstico ACS
                    <HelpTooltip
                      term="ACS"
                      description={providerGlossary.acs.description}
                    />
                  </span>
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
          {showN1Advisor && (
            <N1AdvisorChat
              customerId={profile.customer.id}
              profile={profile}
              onDocumentationChange={setTicketDescription}
              onOutcomeChange={setTicketOutcome}
            />
          )}
          <form className="n1-ticket-card" onSubmit={createTicket}>
            <header>
              <div>
                <span className="section-label">Registro do atendimento</span>
                <h2>Abrir chamado para este cliente</h2>
                <p>
                  O chamado registra esta ligação. Ele pode ser individual ou
                  ficar vinculado a um problema compartilhado do NOC.
                </p>
              </div>
              <TicketPlus size={26} />
            </header>
            <div className="n1-ticket-fields">
              <label>
                Responsável pelo atendimento
                <input
                  value={ticketOpenedBy}
                  onChange={(event) => setTicketOpenedBy(event.target.value)}
                  placeholder="Nome ou matrícula"
                  maxLength={100}
                  required
                />
              </label>
              <label>
                Categoria
                <select
                  value={ticketCategory}
                  onChange={(event) => setTicketCategory(event.target.value)}
                >
                  <option>Lentidão</option>
                  <option>Sem conexão</option>
                  <option>Wi-Fi</option>
                </select>
              </label>
              <label>
                Encaminhamento
                <select
                  value={ticketOutcome}
                  onChange={(event) =>
                    setTicketOutcome(event.target.value as typeof ticketOutcome)
                  }
                >
                  <option value="resolver_telefone">
                    Resolvido por telefone
                  </option>
                  <option value="escalar_noc">Escalar para o NOC</option>
                  <option value="agendar_visita">Agendar visita técnica</option>
                </select>
              </label>
              <label className="n1-ticket-description">
                Relato do cliente
                <textarea
                  value={ticketDescription}
                  onChange={(event) => setTicketDescription(event.target.value)}
                  minLength={10}
                  maxLength={600}
                  required
                />
              </label>
            </div>
            <div className="n1-ticket-footer">
              <div className="n1-ticket-link">
                <Network size={17} />
                {profile.decision.relatedProblemId ? (
                  <span>
                    {profile.decision.relatedProblemKind === "incident"
                      ? "Vinculado ao agrupamento ativo do NOC: "
                      : "Sinal relacionado detectado: "}
                    <strong>
                      {profile.decision.relatedProblemTitle ??
                        profile.decision.relatedProblemId}
                    </strong>
                    <small>
                      Referência interna: {profile.decision.relatedProblemId}
                    </small>
                    <HelpTooltip
                      term={
                        profile.decision.relatedProblemKind === "incident"
                          ? "Vínculo com agrupamento"
                          : "Sinal relacionado"
                      }
                      description={
                        profile.decision.relatedProblemKind === "incident"
                          ? "O chamado continua sendo individual, mas aponta para um agrupamento operacional já registrado pelo NOC."
                          : "Há um padrão conhecido nos dados, mas ele ainda não representa um agrupamento operacional confirmado. Se escalado, o chamado entra na fila do NOC."
                      }
                    />
                  </span>
                ) : (
                  <span>
                    Chamado individual, sem agrupamento coletivo associado.
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={
                  ticketBusy ||
                  ticketOpenedBy.trim().length < 2 ||
                  ticketDescription.trim().length < 10
                }
              >
                <TicketPlus size={16} />
                {ticketBusy ? "Abrindo…" : "Abrir chamado"}
              </button>
            </div>
            {ticketError && <p className="n1-ticket-error">{ticketError}</p>}
            {createdTicket && (
              <p className="n1-ticket-success">
                <CheckCircle2 size={16} /> Chamado {createdTicket} aberto e
                incluído no histórico do cliente.
              </p>
            )}
          </form>
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
                    <strong>
                      <TechnicalText text={ticket.category} />
                    </strong>
                    <p>
                      <TechnicalText text={ticket.description} />
                    </p>
                    <small>
                      <TechnicalText text={ticket.resolution} />
                    </small>
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

function LoginScreen({ onLogin }: { onLogin: (user: DemoUser) => void }) {
  return (
    <main className="login-page">
      <section className="login-shell" aria-labelledby="login-title">
        <div className="login-intro">
          <a className="login-brand" href="#" aria-label="Ondaluz Ops">
            <span className="brand-mark">
              <RadioTower size={21} />
            </span>
            <span>
              <strong>Ondaluz</strong>
              <small>Operations intelligence</small>
            </span>
          </a>
          <div className="login-intro-copy">
            <span className="login-eyebrow">Ambiente de demonstração</span>
            <h1>Uma operação conectada começa pelo contexto certo.</h1>
            <p>
              Escolha um perfil para explorar os fluxos de administração,
              atendimento N1 ou operação NOC.
            </p>
          </div>
          <div className="login-signal" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="login-intro-note">
            <ShieldCheck size={18} />
            <span>
              <strong>Acesso simplificado</strong>
              <small>Sem senha e sem cadastro neste protótipo.</small>
            </span>
          </div>
        </div>

        <div className="login-panel">
          <div className="login-heading">
            <span className="section-label">Acessar a plataforma</span>
            <h2 id="login-title">Quem está entrando?</h2>
            <p>Selecione um usuário para iniciar com as permissões do papel.</p>
          </div>
          <div className="login-users">
            {demoUsers.map((user) => (
              <button
                className={`login-user-card ${user.role}`}
                key={user.id}
                type="button"
                onClick={() => onLogin(user)}
                aria-label={`Entrar como ${user.name}, ${user.roleLabel}`}
              >
                <span className="login-avatar">{user.initials}</span>
                <span className="login-user-copy">
                  <span className="login-role">{user.roleLabel}</span>
                  <strong>{user.name}</strong>
                  <small>{user.description}</small>
                </span>
                <span className="login-enter" aria-hidden="true">
                  <ArrowRight size={18} />
                </span>
              </button>
            ))}
          </div>
          <p className="login-disclaimer">
            A identidade selecionada fica salva somente neste navegador. Este
            fluxo simula autenticação e não protege a API.
          </p>
        </div>
      </section>
    </main>
  );
}

function OperationsApp({
  user,
  onLogout,
}: {
  user: DemoUser;
  onLogout: () => void;
}) {
  const agentPolicy = useAgentPolicy();
  const showGroupingAgent = groupingAgentEnabled(agentPolicy);
  const [view, setView] = useState<View>(() => defaultViewFor(user.role));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [supportCustomer, setSupportCustomer] = useState<string>();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [nocTicketCount, setNocTicketCount] = useState(0);
  const [ticketPreset, setTicketPreset] = useState<{
    key: number;
    filters: TicketFilter[];
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .overview()
      .then(setOverview)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Erro ao carregar"),
      );
  }, []);

  async function refreshNocTicketCount() {
    if (!canAccessView(user.role, "noc")) return;
    try {
      const queue = await api.nocQueue();
      setNocTicketCount(queue.totalItems);
    } catch {
      // A fila principal continua utilizável mesmo se o contador falhar.
    }
  }

  useEffect(() => {
    void refreshNocTicketCount();
    const timer = window.setInterval(
      () => void refreshNocTicketCount(),
      10_000,
    );
    return () => window.clearInterval(timer);
  }, [user.role]);

  function openNocTickets() {
    setTicketPreset({
      key: Date.now(),
      filters: [
        {
          kind: "nocStatus",
          value: "pending",
          label: "Aguardando NOC",
          detail: "Situação NOC",
        },
        {
          kind: "nocStatus",
          value: "in_progress",
          label: "Em análise pelo NOC",
          detail: "Situação NOC",
        },
      ],
    });
    navigate("tickets");
  }
  function navigate(nextView: View) {
    if (!canAccessView(user.role, nextView)) return;
    setView(nextView);
    setSidebarOpen(false);
  }
  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${sidebarOpen ? "open" : ""}`}
        aria-label="Navegação principal"
      >
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            navigate(defaultViewFor(user.role));
          }}
          aria-label="Ir para a página inicial"
        >
          <span className="brand-mark">
            <RadioTower size={20} />
          </span>
          <span>
            <strong>Ondaluz</strong>
            <small>Operations intelligence</small>
          </span>
        </a>
        <nav aria-label="Áreas da aplicação">
          <span className="sidebar-section-label">Operação</span>
          {canAccessView(user.role, "dashboard") && (
            <button
              className={view === "dashboard" ? "active" : ""}
              title="Indicadores consolidados do parque e do suporte."
              aria-current={view === "dashboard" ? "page" : undefined}
              onClick={() => navigate("dashboard")}
            >
              <LayoutDashboard size={17} />
              Dashboard
            </button>
          )}
          {canAccessView(user.role, "noc") && (
            <button
              className={view === "noc" ? "active" : ""}
              title={providerGlossary.noc.description}
              aria-current={view === "noc" ? "page" : undefined}
              onClick={() => navigate("noc")}
            >
              <Activity size={17} />
              Visão NOC
            </button>
          )}
          {canAccessView(user.role, "support") && (
            <button
              className={view === "support" ? "active" : ""}
              title={providerGlossary.n1.description}
              aria-current={view === "support" ? "page" : undefined}
              onClick={() => navigate("support")}
            >
              <Headphones size={17} />
              Atendimento N1
            </button>
          )}
          {showGroupingAgent && canAccessView(user.role, "investigations") && (
            <button
              className={view === "investigations" ? "active" : ""}
              title="Fila de investigações do agente com aprovação humana obrigatória."
              aria-current={view === "investigations" ? "page" : undefined}
              onClick={() => navigate("investigations")}
            >
              <BrainCircuit size={17} />
              Revisão IA
            </button>
          )}
          {canAccessView(user.role, "agent-config") && (
            <button
              className={view === "agent-config" ? "active" : ""}
              title="Configure as capacidades e os recursos consultáveis do agente IA."
              aria-current={view === "agent-config" ? "page" : undefined}
              onClick={() => navigate("agent-config")}
            >
              <Settings2 size={17} />
              Configuração IA
            </button>
          )}
          {canAccessView(user.role, "tickets") && (
            <button
              className={view === "tickets" ? "active" : ""}
              aria-current={view === "tickets" ? "page" : undefined}
              onClick={() => {
                setTicketPreset(null);
                navigate("tickets");
              }}
            >
              <TicketCheck size={17} />
              Tickets
              {canAccessView(user.role, "noc") && nocTicketCount > 0 && (
                <span
                  className="sidebar-ticket-badge"
                  aria-label={`${nocTicketCount} tickets atribuídos ao NOC`}
                >
                  {nocTicketCount > 99 ? "99+" : nocTicketCount}
                </span>
              )}
            </button>
          )}
          {canAccessView(user.role, "diagnostics") && (
            <button
              className={view === "diagnostics" ? "active" : ""}
              aria-current={view === "diagnostics" ? "page" : undefined}
              onClick={() => navigate("diagnostics")}
            >
              <Gauge size={17} />
              Medições
            </button>
          )}
          {canAccessView(user.role, "topology") && (
            <button
              className={view === "topology" ? "active" : ""}
              aria-current={view === "topology" ? "page" : undefined}
              onClick={() => navigate("topology")}
            >
              <GitBranch size={17} />
              Infraestrutura de rede
            </button>
          )}
          {canAccessView(user.role, "inventory") && (
            <button
              className={view === "inventory" ? "active" : ""}
              aria-current={view === "inventory" ? "page" : undefined}
              onClick={() => navigate("inventory")}
            >
              <Boxes size={17} />
              Equipamentos
            </button>
          )}
        </nav>
        <div className="sidebar-user">
          <span className={`sidebar-avatar ${user.role}`}>{user.initials}</span>
          <span className="sidebar-user-copy">
            <strong>{user.name}</strong>
            <small>{user.roleLabel}</small>
          </span>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sair e trocar de usuário"
            title="Sair e trocar de usuário"
          >
            <LogOut size={16} />
          </button>
        </div>
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
      </aside>
      <button
        className="sidebar-toggle"
        aria-label={sidebarOpen ? "Fechar menu" : "Abrir menu"}
        title={sidebarOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={sidebarOpen}
        onClick={() => setSidebarOpen((current) => !current)}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      {sidebarOpen && (
        <button
          className="sidebar-overlay"
          aria-label="Fechar menu de navegação"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        className={`app-content ${view === "topology" ? "topology-content" : ""}`}
      >
        <main className={view === "topology" ? "topology-main" : undefined}>
          {view === "inventory" ? (
            <InventoryDirectory
              canOpenSupport={canAccessView(user.role, "support")}
              onOpenSupport={(customerId) => {
                setSupportCustomer(customerId);
                navigate("support");
              }}
            />
          ) : view === "investigations" && showGroupingAgent ? (
            <InvestigationReview />
          ) : view === "agent-config" ? (
            <AgentConfiguration />
          ) : view === "topology" ? (
            <TopologyMap />
          ) : view === "tickets" ? (
            <SupportTickets
              canManageNoc={canAccessView(user.role, "noc")}
              preset={ticketPreset}
              onNocQueueChanged={refreshNocTicketCount}
              onOpenSupport={(customerId) => {
                setSupportCustomer(customerId);
                navigate("support");
              }}
            />
          ) : view === "diagnostics" ? (
            <DiagnosticsDirectory />
          ) : view === "support" ? (
            <SupportDesk initialCustomer={supportCustomer} />
          ) : error ? (
            <div className="fatal-error">
              <AlertTriangle />
              {error}
            </div>
          ) : !overview ? (
            <div className="loading">
              <span />
              <p>Consolidando sinais da rede…</p>
            </div>
          ) : view === "dashboard" ? (
            <DynamicDashboard
              initialOverview={overview}
              userId={user.id}
              fallback={<ExecutiveDashboard overview={overview} />}
            />
          ) : (
            <NocDashboard
              nocTicketCount={nocTicketCount}
              onOpenNocTickets={openNocTickets}
            />
          )}
        </main>
        {view !== "topology" && (
          <footer className="app-footer">
            <span>Ondaluz Ops · protótipo de decisão operacional</span>
            <span>
              As recomendações mostram evidência e confiança — a ação continua
              humana.
            </span>
          </footer>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<DemoUser | null>(() => loadSession());

  function login(nextUser: DemoUser) {
    saveSession(nextUser);
    setUser(nextUser);
  }

  function logout() {
    clearSession();
    setUser(null);
  }

  if (!user) return <LoginScreen onLogin={login} />;

  return <OperationsApp key={user.id} user={user} onLogout={logout} />;
}
