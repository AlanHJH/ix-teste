import { Fragment, useEffect, useId, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  MapPin,
  Network,
  RadioTower,
  Server,
  ShieldCheck,
  TicketCheck,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { api } from "./api";
import { DEEP_ANALYSIS_PROMPT, DeepAnalysisPanel } from "./DeepAnalysisPanel";
import { n1GuidanceEnabled, useAgentPolicy } from "./agentPolicy";
import { SideDrawer } from "./SideDrawer";
import { TechnicalText } from "./ProviderGlossary";
import type {
  CustomerDetail,
  CustomerDetailEquipment,
  CustomerSummary,
  N1DeepAnalysis,
  SupportProfile,
} from "./types";

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const problemStatusLabel: Record<
  SupportProfile["problemHistory"][number]["status"],
  string
> = {
  open: "Aberto",
  mitigating: "Em mitigação",
  monitoring: "Em observação",
  resolved: "Resolvido",
};

const severityLabel: Record<
  SupportProfile["problemHistory"][number]["severity"],
  string
> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

function formattedDate(value: string | null | undefined) {
  if (!value) return "Não informado";
  const parsed = new Date(value.includes("T") ? value : value + "T12:00:00");
  return Number.isNaN(parsed.valueOf()) ? value : date.format(parsed);
}

function formattedDateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : dateTime.format(parsed);
}

function equipmentSnapshot(
  profile: SupportProfile | null,
  detail: CustomerDetail | null,
) {
  if (profile) {
    return {
      serial: profile.equipment.serial,
      vendor: profile.equipment.vendor,
      model: profile.equipment.model,
      firmware: profile.equipment.firmware,
      planMbps: profile.equipment.planMbps,
      network: profile.equipment.network,
      status: "active" as const,
    };
  }
  const equipment =
    detail?.equipment_history.find((item) => item.status === "active") ??
    detail?.equipment_history[0];
  if (!equipment) return null;
  return {
    serial: equipment.serial,
    vendor: equipment.vendor,
    model: equipment.model,
    firmware: equipment.software_version,
    planMbps: equipment.plan_mbps,
    network:
      equipment.olt + " · PON " + equipment.pon_port + " · " + equipment.cto,
    status: equipment.status,
  };
}

function topologySteps(network: string) {
  return network
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => ({
      key: `${part}-${index}`,
      label:
        part.match(/^(OLT|PON|CTO)/i)?.[1].toUpperCase() ??
        `ETAPA ${index + 1}`,
      value: part,
    }));
}

function TopologyFlow({
  network,
  className = "",
}: {
  network: string;
  className?: string;
}) {
  const steps = topologySteps(network);
  return (
    <div
      className={`customer-detail-topology-flow ${className}`.trim()}
      aria-label={`Caminho de infraestrutura: ${network}`}
    >
      {steps.map((step, index) => (
        <Fragment key={step.key}>
          {index > 0 && (
            <span className="customer-detail-topology-arrow" aria-hidden="true">
              →
            </span>
          )}
          <span className="customer-detail-topology-node">
            <span>{step.label}</span>
            <strong>{step.value}</strong>
          </span>
        </Fragment>
      ))}
    </div>
  );
}

export function CustomerDetailDrawer({
  customer,
  displayName,
  canOpenSupport,
  onOpenSupport,
  onClose,
}: {
  customer: CustomerSummary;
  displayName: string;
  canOpenSupport: boolean;
  onOpenSupport: (customerId: string) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const policy = useAgentPolicy();
  const showDeepAnalysis = n1GuidanceEnabled(policy);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [profile, setProfile] = useState<SupportProfile | null>(null);
  const [analysis, setAnalysis] = useState<N1DeepAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setDetail(null);
    setProfile(null);
    setAnalysis(null);
    setAnalysisError("");
    setAnalysisLoading(
      showDeepAnalysis && customer.customer_status === "active",
    );

    const detailRequest = api.customer(customer.customer_id);
    const supportRequest =
      customer.customer_status === "active"
        ? api.support(customer.customer_id)
        : Promise.resolve(null);
    const analysisRequest =
      showDeepAnalysis && customer.customer_status === "active"
        ? api
            .n1Chat(customer.customer_id, DEEP_ANALYSIS_PROMPT, [])
            .catch((reason) => {
              if (!cancelled) {
                setAnalysisError(
                  reason instanceof Error
                    ? reason.message
                    : "Não foi possível consolidar a análise profunda.",
                );
              }
              return null;
            })
        : Promise.resolve(null);

    void Promise.all([detailRequest, supportRequest])
      .then(([nextDetail, nextProfile]) => {
        if (cancelled) return;
        setDetail(nextDetail);
        setProfile(nextProfile);
      })
      .catch((reason) => {
        if (cancelled) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível carregar o detalhe do cliente.",
        );
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    if (analysisRequest) {
      void analysisRequest
        .then((nextReply) => {
          if (!cancelled) setAnalysis(nextReply?.deepAnalysis ?? null);
        })
        .finally(() => {
          if (!cancelled) setAnalysisLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [customer.customer_id, customer.customer_status, showDeepAnalysis]);

  const equipment = equipmentSnapshot(profile, detail);
  const isActive = customer.customer_status === "active";
  const hasTelemetry = Boolean(profile?.metrics.last_day);

  function openTicket() {
    onClose();
    onOpenSupport(customer.customer_id);
  }

  return (
    <SideDrawer
      className="customer-detail-drawer"
      labelledBy={titleId}
      closeLabel="Fechar cliente"
      onClose={onClose}
    >
      <header className="customer-detail-header">
        <span className="customer-detail-avatar" aria-hidden="true">
          <UserRound size={24} />
        </span>
        <div>
          <span className="section-label">Perfil do cliente</span>
          <h2 id={titleId}>{displayName}</h2>
          <p>
            {customer.customer_id} · <MapPin size={13} />{" "}
            {customer.neighborhood} · {customer.city}
          </p>
        </div>
      </header>

      {loading && (
        <div className="customer-detail-loading" role="status">
          <Activity size={18} className="spin" />
          <span>Consolidando cadastro, infraestrutura e histórico…</span>
        </div>
      )}

      {error && (
        <div className="customer-detail-error" role="alert">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      )}

      {detail && !error && (
        <>
          <div className="customer-detail-actions">
            <span
              className={
                "customer-status-badge " + (isActive ? "active" : "cancelled")
              }
            >
              {isActive ? "Cliente ativo" : "Cliente cancelado"}
            </span>
            <button
              type="button"
              disabled={!canOpenSupport || !isActive}
              onClick={openTicket}
            >
              <TicketCheck size={16} /> Abrir chamado no N1
            </button>
          </div>

          {showDeepAnalysis && isActive && (
            <DeepAnalysisPanel
              analysis={analysis}
              loading={analysisLoading}
              error={analysisError}
              compact
            />
          )}

          <section className="customer-detail-observation">
            <div>
              {hasTelemetry ? <Wifi size={19} /> : <WifiOff size={19} />}
              <div className="customer-detail-observation-copy">
                <span>Disponibilidade do CPE</span>
                <strong>{isActive ? "CPE ativa" : "Sem CPE ativa"}</strong>
                {isActive && (
                  <span
                    className={`customer-detail-observation-status ${
                      hasTelemetry ? "is-positive" : "is-muted"
                    }`}
                  >
                    {hasTelemetry
                      ? "Telemetria recente"
                      : "Sem telemetria recente"}
                  </span>
                )}
                <small>
                  {hasTelemetry
                    ? `Último registro: ${formattedDate(profile?.metrics.last_day)}`
                    : isActive
                      ? "Não há evidência recente de presença nesta base."
                      : "Não há CPE ativa no cadastro."}
                </small>
              </div>
            </div>
            <div>
              <ShieldCheck size={19} />
              <div>
                <span>Infraestrutura</span>
                <strong>
                  {profile?.preflight.infrastructureChecked
                    ? "Caminho conferido"
                    : equipment
                      ? "Histórico de equipamento encontrado"
                      : "Sem equipamento registrado"}
                </strong>
                {profile && equipment ? (
                  <>
                    <TopologyFlow
                      network={equipment.network}
                      className="compact"
                    />
                    <small>
                      <TechnicalText text="Caminho consultado no contexto operacional." />
                    </small>
                  </>
                ) : (
                  <small>
                    Não há CPE ativa para validar a infraestrutura atual.
                  </small>
                )}
              </div>
            </div>
          </section>

          <p className="customer-detail-disclaimer">
            <CheckCircle2 size={14} />
            <TechnicalText text="“Telemetria recente” descreve o último sinal registrado; não é um ping em tempo real." />
          </p>

          <section className="customer-detail-section">
            <header className="customer-detail-section-heading">
              <div>
                <span className="section-label">Condição atual</span>
                <h3>Equipamento e rede</h3>
              </div>
              <Network size={20} />
            </header>
            {equipment ? (
              <div className="customer-detail-facts">
                <div>
                  <span>
                    <TechnicalText text="Equipamento" />
                  </span>
                  <strong>
                    {equipment.vendor} {equipment.model}
                  </strong>
                  <small>
                    <TechnicalText text={`Serial ${equipment.serial}`} />
                  </small>
                </div>
                <div>
                  <span>
                    <TechnicalText text="Firmware" />
                  </span>
                  <strong>{equipment.firmware}</strong>
                  <small>
                    <TechnicalText text="Versão registrada na CPE" />
                  </small>
                </div>
                <div>
                  <span>Plano</span>
                  <strong>
                    <TechnicalText text={`${equipment.planMbps} Mbps`} />
                  </strong>
                  <small>
                    <TechnicalText text="Velocidade contratada" />
                  </small>
                </div>
                <div>
                  <span>
                    <TechnicalText text="Topologia" />
                  </span>
                  <TopologyFlow network={equipment.network} />
                  <small>Caminho de conexão na rede</small>
                </div>
              </div>
            ) : (
              <p className="customer-detail-empty">
                Não há equipamento disponível para mostrar neste momento.
              </p>
            )}
          </section>

          {profile && (
            <section className="customer-detail-section">
              <header className="customer-detail-section-heading">
                <div>
                  <span className="section-label">Medições recentes</span>
                  <h3>Como a CPE está se comportando</h3>
                </div>
                <RadioTower size={20} />
              </header>
              <div className="customer-detail-metrics">
                <div>
                  <span>
                    <TechnicalText text="Memória mínima" />
                  </span>
                  <strong>
                    {profile.metrics.mem_min_pct == null
                      ? "n/d"
                      : profile.metrics.mem_min_pct + "%"}
                  </strong>
                </div>
                <div>
                  <span>
                    <TechnicalText text="Reinícios" />
                  </span>
                  <strong>{profile.metrics.reboot_count}</strong>
                </div>
                <div>
                  <span>
                    <TechnicalText text="Sinal óptico mínimo" />
                  </span>
                  <strong>
                    {profile.metrics.optical_rx_min_dbm == null
                      ? "n/d"
                      : profile.metrics.optical_rx_min_dbm + " dBm"}
                  </strong>
                </div>
                <div>
                  <span>
                    <TechnicalText text="Porta LAN mínima" />
                  </span>
                  <strong>
                    {profile.metrics.lan_min_mbps == null
                      ? "n/d"
                      : profile.metrics.lan_min_mbps + " Mbps"}
                  </strong>
                </div>
              </div>
            </section>
          )}

          <section className="customer-detail-section">
            <header className="customer-detail-section-heading">
              <div>
                <span className="section-label">Histórico operacional</span>
                <h3>Problemas relacionados ao cliente</h3>
              </div>
              <ShieldCheck size={20} />
            </header>
            {profile?.problemHistory.length ? (
              <div className="customer-detail-history-list">
                {profile.problemHistory.map((problem) => (
                  <article key={problem.incidentId}>
                    <div className="customer-detail-history-title">
                      <strong>
                        <TechnicalText text={problem.title} />
                      </strong>
                      <span
                        className={
                          "customer-detail-severity " + problem.severity
                        }
                      >
                        {severityLabel[problem.severity]}
                      </span>
                    </div>
                    <small>
                      {problem.incidentId} ·{" "}
                      {problemStatusLabel[problem.status]} ·{" "}
                      {formattedDateTime(problem.openedAt)}
                    </small>
                    <p>
                      <strong>Causa provável:</strong>{" "}
                      <TechnicalText text={problem.probableCause} />
                    </p>
                    <footer>
                      <Clock3 size={13} />
                      <span>{problem.recommendedAction}</span>
                    </footer>
                  </article>
                ))}
              </div>
            ) : (
              <p className="customer-detail-empty">
                Nenhum problema operacional relacionado foi encontrado no
                histórico consultado.
              </p>
            )}
          </section>

          {profile && (
            <section className="customer-detail-section">
              <header className="customer-detail-section-heading">
                <div>
                  <span className="section-label">Atendimentos</span>
                  <h3>Chamados recentes</h3>
                </div>
                <TicketCheck size={20} />
              </header>
              {profile.recentTickets.length > 0 ? (
                <div className="customer-detail-ticket-list">
                  {profile.recentTickets.map((ticket) => (
                    <article key={ticket.ticket_id}>
                      <div>
                        <strong>{ticket.category}</strong>
                        <small>
                          {ticket.ticket_id} ·{" "}
                          {formattedDateTime(ticket.opened_at)}
                        </small>
                      </div>
                      <p>{ticket.description}</p>
                      <span>{ticket.resolution}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="customer-detail-empty">
                  Nenhum chamado encontrado para este cliente.
                </p>
              )}
            </section>
          )}

          <section className="customer-detail-section customer-detail-equipment-history">
            <header className="customer-detail-section-heading">
              <div>
                <span className="section-label">Cadastro</span>
                <h3>Histórico de equipamentos</h3>
              </div>
              <Server size={20} />
            </header>
            <div className="customer-detail-equipment-list">
              {detail.equipment_history.map((item: CustomerDetailEquipment) => (
                <article key={item.serial}>
                  <div>
                    <strong>
                      {item.vendor} {item.model}
                    </strong>
                    <small>
                      {item.serial} · instalado em{" "}
                      {formattedDate(item.installed_at)}
                    </small>
                  </div>
                  <span
                    className={
                      "customer-status-badge " +
                      (item.status === "active" ? "active" : "removed")
                    }
                  >
                    {item.status === "active" ? "Atual" : "Removido"}
                  </span>
                </article>
              ))}
            </div>
          </section>

          {canOpenSupport && isActive && (
            <button
              type="button"
              className="customer-detail-bottom-action"
              onClick={openTicket}
            >
              <TicketCheck size={17} /> Abrir um chamado para este cliente
            </button>
          )}
        </>
      )}
    </SideDrawer>
  );
}
