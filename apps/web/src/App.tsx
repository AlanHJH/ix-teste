import { FormEvent, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
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
import { TicketWorkspacePage } from "./TicketWorkspacePage";
import { DiagnosticsDirectory } from "./DiagnosticsDirectory";
import { NocOperations } from "./NocOperations";
import { AgentConfiguration } from "./AgentConfiguration";
import { N1AdvisorChat } from "./N1AdvisorChat";
import { IrisAssistant } from "./IrisAssistant";
import { DynamicDashboard } from "./DynamicDashboard";
import { OfflineDiagnosis } from "./OfflineDiagnosis";
import { CustomersDirectory } from "./CustomersDirectory";
import { PhysicalTopology } from "./PhysicalTopology";
import { topologyFocusFromSupport } from "./topologyFocus";
import ixcLogo from "./assets/ixc-logo.svg";
import {
  fieldWorkLayerLabels,
  fieldWorkMeasurementOptions,
  opticalFieldWorkCategory,
} from "./ticketFieldWork";
import {
  globalAssistantEnabled,
  n1GuidanceEnabled,
  useAgentPolicy,
} from "./agentPolicy";
import {
  canAccessView,
  clearSession,
  defaultViewFor,
  demoUsers,
  loadAuthSession,
  saveSession,
} from "./auth";
import type { AppView, AuthSession, DemoUser } from "./auth";
import type {
  Overview,
  SupportProfile,
  SupportTicket,
  TicketFilter,
  IrisContext,
  TopologyFocus,
} from "./types";

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
                    <stop
                      offset="0%"
                      stopColor="var(--ixc-accent)"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--ixc-accent)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--ixc-grid)"
                  strokeDasharray="4 4"
                />
                <XAxis dataKey="week" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    border: "0",
                    borderRadius: 12,
                    boxShadow: "0 18px 42px rgba(0,0,0,.28)",
                  }}
                  labelFormatter={(label) => `Semana de ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Chamados"
                  stroke="var(--ixc-accent)"
                  strokeWidth={3}
                  fill="url(#tickets)"
                  dot={{ r: 3, fill: "var(--ixc-surface-1)", strokeWidth: 2 }}
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
  onOpenAssistant,
  operatorName,
  originTicket,
  onOriginTicketConsumed,
}: {
  nocTicketCount: number;
  onOpenNocTickets: () => void;
  onOpenAssistant?: (context: IrisContext) => void;
  operatorName: string;
  originTicket?: SupportTicket | null;
  onOriginTicketConsumed?: () => void;
}) {
  return (
    <NocOperations
      nocTicketCount={nocTicketCount}
      onOpenNocTickets={onOpenNocTickets}
      onOpenAssistant={onOpenAssistant}
      operatorName={operatorName}
      originTicket={originTicket}
      onOriginTicketConsumed={onOriginTicketConsumed}
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

function SupportDesk({
  initialCustomer,
  operatorName,
}: {
  initialCustomer?: string;
  operatorName?: string;
}) {
  const agentPolicy = useAgentPolicy();
  const showN1Advisor = n1GuidanceEnabled(agentPolicy);
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<SupportProfile | null>(null);
  const [connectionFocus, setConnectionFocus] = useState<TopologyFocus | null>(
    null,
  );
  const [topologyFocus, setTopologyFocus] = useState<TopologyFocus | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ticketOpenedBy, setTicketOpenedBy] = useState(operatorName ?? "");
  const [ticketCategory, setTicketCategory] = useState("Lentidão");
  const [ticketDescription, setTicketDescription] = useState("");
  const [fieldWorkLayer, setFieldWorkLayer] =
    useState<keyof typeof fieldWorkLayerLabels>("poste_trecho");
  const [fieldWorkMeasurements, setFieldWorkMeasurements] = useState<string[]>([
    ...fieldWorkMeasurementOptions,
  ]);
  const [ticketOutcome, setTicketOutcome] = useState<
    "resolver_telefone" | "escalar_noc" | "agendar_visita"
  >("escalar_noc");
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketError, setTicketError] = useState("");
  const [createdTicket, setCreatedTicket] = useState("");
  const isOpticalFieldWork = ticketCategory === opticalFieldWorkCategory;

  function suggestedCategory(
    issue: string,
    outcome: "resolver_telefone" | "escalar_noc" | "agendar_visita",
  ) {
    const normalized = issue.toLocaleLowerCase("pt-BR");
    if (
      outcome === "agendar_visita" &&
      /(fec|ópt|opt|fibra|pon|cto|splitter|trecho compartilhado)/i.test(
        normalized,
      )
    ) {
      return "Medição óptica em campo";
    }
    if (normalized.includes("wi-fi")) return "Wi-Fi";
    if (normalized.includes("fibra") || normalized.includes("sinal óptico")) {
      return "Sem conexão";
    }
    return "Lentidão";
  }

  function historyStatusLabel(
    status: SupportProfile["problemHistory"][number]["status"],
  ) {
    return {
      open: "Aberto",
      mitigating: "Em mitigação",
      monitoring: "Em observação",
      resolved: "Resolvido",
    }[status];
  }

  async function load(customerId: string) {
    setLoading(true);
    setError("");
    setQuery(customerId);
    setConnectionFocus(null);
    setTopologyFocus(null);
    try {
      const nextProfile = await api.support(customerId.trim().toUpperCase());
      setProfile(nextProfile);
      const nextTopologyFocus = topologyFocusFromSupport(nextProfile);
      setConnectionFocus(nextTopologyFocus);
      setTicketCategory(
        suggestedCategory(
          nextProfile.decision.issue,
          nextProfile.decision.action,
        ),
      );
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

  useEffect(() => {
    if (operatorName) {
      setTicketOpenedBy((current) => current.trim() || operatorName);
    }
  }, [operatorName]);

  const ticketOutcomeLabel = {
    resolver_telefone: "Registrar como resolvido no N1",
    escalar_noc: "Registrar e encaminhar ao NOC",
    agendar_visita: "Registrar visita técnica",
  }[ticketOutcome];

  function goToTicketForm() {
    const form = document.getElementById("n1-ticket-form");
    form?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      form
        ?.querySelector<HTMLTextAreaElement>("textarea")
        ?.focus({ preventScroll: true });
    }, 250);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (query.trim()) void load(query);
  }

  async function createTicket(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    if (isOpticalFieldWork && fieldWorkMeasurements.length === 0) {
      setTicketError("Selecione ao menos uma medição para a equipe de campo.");
      return;
    }
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
        sourcePayload: {
          customer: profile.customer,
          equipment: profile.equipment,
          metrics: profile.metrics,
          decision: profile.decision,
          preflight: profile.preflight,
          problemHistory: profile.problemHistory,
          activeIncidents: profile.activeIncidents,
          recentTickets: profile.recentTickets,
          allTickets: profile.allTickets,
          field_work: isOpticalFieldWork
            ? {
                category: opticalFieldWorkCategory,
                technician: ticketOpenedBy,
                layer: fieldWorkLayer,
                layerLabel: fieldWorkLayerLabels[fieldWorkLayer],
                measurements: fieldWorkMeasurements,
                networkPath: profile.equipment.network,
              }
            : null,
          atendimento: {
            openedBy: ticketOpenedBy,
            category: ticketCategory,
            description: ticketDescription,
            outcome: ticketOutcome,
            relatedProblemId: profile.decision.relatedProblemId,
            fieldWorkLayer: isOpticalFieldWork ? fieldWorkLayer : null,
            fieldWorkMeasurements: isOpticalFieldWork
              ? fieldWorkMeasurements
              : [],
          },
        },
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
              <strong>
                <TechnicalText
                  text={profile.equipment.network.split(" · ")[0]}
                />
              </strong>
              <small>
                <TechnicalText
                  text={profile.equipment.network
                    .split(" · ")
                    .slice(1)
                    .join(" · ")}
                />
              </small>
            </div>
          </div>
          <section
            className="n1-journey-card"
            aria-labelledby="n1-journey-title"
          >
            <div className="n1-journey-heading">
              <span className="section-label">Roteiro do atendimento</span>
              <h2 id="n1-journey-title">
                Cliente identificado. Decida e registre.
              </h2>
              <p>
                Os dados do cliente, do equipamento e da rede já estão
                conferidos. Siga a orientação abaixo e registre o desfecho da
                ligação.
              </p>
            </div>
            <div
              className="n1-journey-steps"
              aria-label="Etapas concluídas do atendimento"
            >
              <div className="n1-journey-step">
                <CheckCircle2 size={16} />
                <span>1 · Cliente</span>
                <strong>{profile.customer.id}</strong>
              </div>
              <div className="n1-journey-step">
                <CheckCircle2 size={16} />
                <span>2 · Equipamento</span>
                <strong>
                  {profile.equipment.vendor} {profile.equipment.model}
                </strong>
              </div>
              <div className="n1-journey-step current">
                <ArrowRight size={16} />
                <span>3 · Próximo passo</span>
                <strong>{ticketOutcomeLabel}</strong>
              </div>
            </div>
            <div className="n1-journey-action">
              <span>Quando terminar a ligação</span>
              <strong>{ticketOutcomeLabel}</strong>
              <button type="button" onClick={goToTicketForm}>
                Ir para o registro <ArrowRight size={15} />
              </button>
            </div>
          </section>
          <section
            className="n1-preflight"
            aria-labelledby="n1-preflight-title"
          >
            <header className="n1-preflight-header">
              <div>
                <span className="section-label">Análise antes do chamado</span>
                <h2 id="n1-preflight-title">Contexto de rede verificado</h2>
                <p>
                  A orientação combina o caminho da infraestrutura, as medições
                  recentes e o histórico de problemas alcançáveis pelo cliente.
                </p>
              </div>
              <span className="n1-preflight-ready">
                <CheckCircle2 size={15} /> Análise pronta
              </span>
            </header>
            {connectionFocus && (
              <div className="n1-connection-alert" role="status">
                <div>
                  <span className="section-label">
                    Problema de conexão detectado
                  </span>
                  <strong>
                    O caminho afetado foi identificado; abra o mapa quando
                    precisar aprofundar a análise.
                  </strong>
                  <small>
                    <TechnicalText
                      text={`${connectionFocus.scope.olt} · PON ${connectionFocus.scope.pon} · ${connectionFocus.scope.cto}`}
                    />
                  </small>
                </div>
                <button
                  type="button"
                  className="grouping-topology-open"
                  onClick={() => setTopologyFocus(connectionFocus)}
                >
                  <Network size={15} aria-hidden="true" />
                  Ver onde está a falha
                </button>
              </div>
            )}
            <div className="n1-preflight-checks">
              <article>
                <span>Infraestrutura</span>
                <strong>Conferida</strong>
                <small>
                  <TechnicalText text={profile.equipment.network} />
                </small>
              </article>
              <article>
                <span>Histórico do NOC</span>
                <strong>
                  {profile.preflight.relatedHistoryFound
                    ? `${profile.problemHistory.length} problema(s) relacionado(s)`
                    : "Nenhum relacionado"}
                </strong>
                <small>
                  {profile.activeIncidents.length > 0
                    ? `${profile.activeIncidents.length} ativo(s) alcançam este cliente`
                    : "Consulta concluída no histórico operacional"}
                </small>
              </article>
              <article>
                <span>Medições</span>
                <strong>
                  {profile.preflight.measurementStatus === "related_history"
                    ? "Compatíveis com histórico"
                    : profile.preflight.measurementStatus === "new_signal"
                      ? "Novo sinal identificado"
                      : "Sem sinal conclusivo"}
                </strong>
                <small>
                  <TechnicalText text={profile.decision.issue} />
                </small>
              </article>
            </div>
            <div className="n1-preflight-guidance">
              <div className="n1-preflight-advice">
                <span>Principal dica para o cliente</span>
                <p>“{profile.preflight.mainAdvice}”</p>
              </div>
              <div className="n1-preflight-escalation">
                <span>Próximo destino</span>
                <strong>
                  {profile.preflight.escalation.required
                    ? "Encaminhar para o NOC"
                    : "Acompanhar no N1"}
                </strong>
                <small>{profile.preflight.escalation.reason}</small>
              </div>
            </div>
            {profile.preflight.measurementStatus === "new_signal" &&
              !profile.preflight.relatedHistoryFound && (
                <p className="n1-preflight-new-signal">
                  Nenhum problema relacionado foi encontrado no histórico. As
                  medições geraram um novo sinal para ser enviado ao NOC junto
                  com este chamado, caso o atendente mantenha o escalonamento.
                </p>
              )}
            {profile.problemHistory.length > 0 && (
              <div className="n1-preflight-history">
                <span>Problemas relacionados encontrados</span>
                <div>
                  {profile.problemHistory.slice(0, 3).map((problem) => (
                    <article key={problem.incidentId}>
                      <strong>{problem.incidentId}</strong>
                      <span>
                        <TechnicalText text={problem.title} />
                      </span>
                      <small>
                        {historyStatusLabel(problem.status)} ·{" "}
                        {new Date(problem.openedAt).toLocaleDateString("pt-BR")}
                      </small>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
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
          <form
            id="n1-ticket-form"
            className="n1-ticket-card"
            onSubmit={createTicket}
          >
            <header>
              <div>
                <span className="section-label">Registro do atendimento</span>
                <h2>Registrar próximo passo</h2>
                <p>
                  Confirme o relato e salve a decisão: {ticketOutcomeLabel}. O
                  contexto técnico será anexado automaticamente.
                </p>
              </div>
              <TicketPlus size={26} />
            </header>
            <div className="n1-ticket-fields">
              <label>
                <span className="form-field-label">
                  Responsável pelo atendimento
                </span>
                <input
                  value={ticketOpenedBy}
                  onChange={(event) => setTicketOpenedBy(event.target.value)}
                  placeholder="Nome ou matrícula"
                  maxLength={100}
                  required
                />
                <small className="n1-field-hint form-field-description">
                  {operatorName
                    ? "Preenchido pela sessão atual; altere se necessário."
                    : "Nome ou matrícula de quem conduziu a ligação."}
                </small>
              </label>
              <label>
                <span className="form-field-label">Categoria</span>
                <select
                  value={ticketCategory}
                  onChange={(event) => {
                    const nextCategory = event.target.value;
                    setTicketCategory(nextCategory);
                    if (nextCategory === opticalFieldWorkCategory) {
                      setTicketOutcome("agendar_visita");
                    }
                  }}
                >
                  <option>Lentidão</option>
                  <option>Sem conexão</option>
                  <option>Wi-Fi</option>
                  <option>{opticalFieldWorkCategory}</option>
                </select>
                <small className="form-field-description">
                  Classifique o motivo principal do contato.
                </small>
              </label>
              <label>
                <span className="form-field-label">Encaminhamento</span>
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
                <small className="form-field-description">
                  Defina o próximo destino após a conversa.
                </small>
              </label>
              <label className="n1-ticket-description">
                <span className="form-field-label">Relato do cliente</span>
                <textarea
                  value={ticketDescription}
                  onChange={(event) => setTicketDescription(event.target.value)}
                  minLength={10}
                  maxLength={600}
                  required
                />
                <small className="form-field-description">
                  Registre o que o cliente relatou e o que foi confirmado.
                </small>
              </label>
              {isOpticalFieldWork && (
                <fieldset className="n1-fieldwork-panel">
                  <legend>Camada de execução em campo</legend>
                  <p>
                    Registre até onde o técnico precisa ir e quais medições
                    devem voltar para o histórico do ticket.
                  </p>
                  <div className="n1-fieldwork-grid">
                    <div className="n1-fieldwork-owner">
                      <span>Responsável pela execução</span>
                      <strong>
                        {ticketOpenedBy || "Informe o responsável acima"}
                      </strong>
                      <small>
                        O nome da sessão fica preservado no payload técnico.
                      </small>
                    </div>
                    <label>
                      <span className="form-field-label">Camada física</span>
                      <select
                        value={fieldWorkLayer}
                        onChange={(event) =>
                          setFieldWorkLayer(
                            event.target
                              .value as keyof typeof fieldWorkLayerLabels,
                          )
                        }
                      >
                        {Object.entries(fieldWorkLayerLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                      <small className="form-field-description">
                        Indique até onde a visita precisa investigar.
                      </small>
                    </label>
                  </div>
                  <div className="n1-fieldwork-checklist">
                    <span>Medições previstas</span>
                    <div>
                      {fieldWorkMeasurementOptions.map((measurement) => (
                        <label key={measurement}>
                          <input
                            type="checkbox"
                            checked={fieldWorkMeasurements.includes(
                              measurement,
                            )}
                            onChange={(event) =>
                              setFieldWorkMeasurements((current) =>
                                event.target.checked
                                  ? [...current, measurement]
                                  : current.filter(
                                      (item) => item !== measurement,
                                    ),
                              )
                            }
                          />
                          {measurement}
                        </label>
                      ))}
                    </div>
                  </div>
                </fieldset>
              )}
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
                {ticketBusy ? "Registrando…" : ticketOutcomeLabel}
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
      {topologyFocus && (
        <PhysicalTopology
          focus={topologyFocus}
          onClose={() => setTopologyFocus(null)}
        />
      )}
    </>
  );
}

function LoginScreen({
  onLogin,
}: {
  onLogin: (user: DemoUser, password: string) => Promise<void>;
}) {
  const [selectedUser, setSelectedUser] = useState(demoUsers[0]);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await onLogin(selectedUser, password);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível entrar.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell" aria-labelledby="login-title">
        <div className="login-intro">
          <a className="login-brand" href="#" aria-label="IXC ACS">
            <img className="login-brand-logo" src={ixcLogo} alt="IXC ACS" />
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
              <small>Três perfis com permissões operacionais distintas.</small>
            </span>
          </div>
        </div>

        <div className="login-panel">
          <div className="login-heading">
            <span className="section-label">Acessar a plataforma</span>
            <h2 id="login-title">Quem está entrando?</h2>
            <p>Selecione um usuário e informe a senha para iniciar.</p>
          </div>
          <div className="login-users">
            {demoUsers.map((user) => (
              <button
                className={`login-user-card ${user.role} ${selectedUser.id === user.id ? "selected" : ""}`}
                key={user.id}
                type="button"
                onClick={() => setSelectedUser(user)}
                aria-label={`Entrar como ${user.name}, ${user.roleLabel}`}
                aria-pressed={selectedUser.id === user.id}
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
          <form className="login-form" onSubmit={submit}>
            <label htmlFor="login-password">Senha</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite a senha"
              required
            />
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="login-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Validando…" : `Entrar como ${selectedUser.name}`}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </form>
          <p className="login-disclaimer">
            Senha dos três perfis: <strong>Teste@123</strong>. O acesso é
            validado pela API e a sessão usa um token JWT de curta duração.
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
  const [view, setView] = useState<View>(() => defaultViewFor(user.role));
  const assistantEnabled = globalAssistantEnabled(agentPolicy);
  const showGlobalAssistant = view === "noc" && assistantEnabled;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [supportCustomer, setSupportCustomer] = useState<string>();
  const [offlineCustomer, setOfflineCustomer] = useState<string>();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [nocTicketCount, setNocTicketCount] = useState(0);
  const [ticketPreset, setTicketPreset] = useState<{
    key: number;
    filters: TicketFilter[];
  } | null>(null);
  const [ticketWorkspace, setTicketWorkspace] = useState<SupportTicket | null>(
    null,
  );
  const [nocOriginTicket, setNocOriginTicket] = useState<SupportTicket | null>(
    null,
  );
  const [assistantContext, setAssistantContext] = useState<IrisContext>({});
  const [assistantRequestKey, setAssistantRequestKey] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    function handleTechnicalExplanation(event: Event) {
      const detail = (
        event as CustomEvent<{
          technicalTerm?: string;
          technicalDescription?: string;
        }>
      ).detail;
      if (!detail?.technicalTerm) return;
      setAssistantContext({
        entity: detail.technicalTerm,
        selection: detail.technicalDescription,
        technicalTerm: detail.technicalTerm,
        technicalDescription: detail.technicalDescription,
      });
      setAssistantRequestKey((current) => current + 1);
    }

    window.addEventListener(
      "ondaluz:agent-explain",
      handleTechnicalExplanation,
    );
    return () =>
      window.removeEventListener(
        "ondaluz:agent-explain",
        handleTechnicalExplanation,
      );
  }, []);

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
    setTicketWorkspace(null);
    setAssistantContext({});
    setView(nextView);
    setSidebarOpen(false);
  }

  function openNocGrouping(ticket: SupportTicket) {
    setNocOriginTicket(ticket);
    navigate("noc");
  }

  function openAssistant(context: IrisContext) {
    setAssistantContext(context);
    setAssistantRequestKey((current) => current + 1);
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
          <img className="brand-logo" src={ixcLogo} alt="IXC ACS" />
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
          {canAccessView(user.role, "customers") && (
            <button
              className={view === "customers" ? "active" : ""}
              aria-current={view === "customers" ? "page" : undefined}
              onClick={() => navigate("customers")}
            >
              <Users size={17} />
              Clientes
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
          ) : view === "customers" ? (
            <CustomersDirectory
              canOpenSupport={canAccessView(user.role, "support")}
              onOpenSupport={(customerId) => {
                setSupportCustomer(customerId);
                navigate("support");
              }}
            />
          ) : view === "agent-config" ? (
            <AgentConfiguration />
          ) : view === "topology" ? (
            <TopologyMap onOpenNoc={() => navigate("noc")} />
          ) : view === "tickets" ? (
            ticketWorkspace ? (
              <TicketWorkspacePage
                ticket={ticketWorkspace}
                canManageNoc={canAccessView(user.role, "noc")}
                canOpenAssistant={assistantEnabled}
                onBack={() => setTicketWorkspace(null)}
                onOpenTicket={setTicketWorkspace}
                onOpenAssistant={assistantEnabled ? openAssistant : undefined}
                onNocQueueChanged={refreshNocTicketCount}
                onOpenGrouping={openNocGrouping}
              />
            ) : (
              <SupportTickets
                preset={ticketPreset}
                canOpenAssistant={assistantEnabled}
                onOpenTicket={setTicketWorkspace}
                onOpenAssistant={assistantEnabled ? openAssistant : undefined}
                onOpenSupport={(customerId) => {
                  setSupportCustomer(customerId);
                  navigate("support");
                }}
              />
            )
          ) : view === "diagnostics" ? (
            <DiagnosticsDirectory />
          ) : view === "support" ? (
            <SupportDesk
              initialCustomer={supportCustomer}
              operatorName={user.name}
            />
          ) : view === "offline-diagnosis" ? (
            <OfflineDiagnosis
              customerId={offlineCustomer}
              backLabel={
                canAccessView(user.role, "dashboard")
                  ? "Voltar ao dashboard"
                  : "Voltar ao atendimento N1"
              }
              onBack={() =>
                navigate(
                  canAccessView(user.role, "dashboard")
                    ? "dashboard"
                    : defaultViewFor(user.role),
                )
              }
              onOpenSupport={(customerId) => {
                setSupportCustomer(customerId);
                navigate("support");
              }}
            />
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
            <>
              <DynamicDashboard
                initialOverview={overview}
                userId={user.id}
                onOpenOfflineDiagnosis={(customerId) => {
                  setOfflineCustomer(customerId);
                  navigate("offline-diagnosis");
                }}
                fallback={<ExecutiveDashboard overview={overview} />}
              />
            </>
          ) : (
            <NocDashboard
              nocTicketCount={nocTicketCount}
              onOpenNocTickets={openNocTickets}
              onOpenAssistant={assistantEnabled ? openAssistant : undefined}
              operatorName={user.name}
              originTicket={nocOriginTicket}
              onOriginTicketConsumed={() => setNocOriginTicket(null)}
            />
          )}
        </main>
        {view !== "topology" && (
          <footer className="app-footer">
            <span>IXC ACS · protótipo de decisão operacional</span>
            <span>
              As recomendações mostram evidência e confiança — a ação continua
              humana.
            </span>
          </footer>
        )}
      </div>
      {assistantEnabled && (
        <IrisAssistant
          view={view}
          context={assistantContext}
          requestKey={assistantRequestKey}
          showLauncher={showGlobalAssistant}
        />
      )}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() =>
    loadAuthSession(),
  );

  useEffect(() => {
    const handleUnauthorized = () => {
      clearSession();
      setSession(null);
    };
    window.addEventListener("ondaluz:unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("ondaluz:unauthorized", handleUnauthorized);
  }, []);

  async function login(nextUser: DemoUser, password: string) {
    const result = await api.login(nextUser.username, password);
    saveSession(nextUser, result.accessToken);
    setSession({ user: nextUser, accessToken: result.accessToken });
  }

  function logout() {
    clearSession();
    setSession(null);
  }

  if (!session) return <LoginScreen onLogin={login} />;

  return (
    <OperationsApp
      key={session.user.id}
      user={session.user}
      onLogout={logout}
    />
  );
}
