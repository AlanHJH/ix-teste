import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cpu,
  MapPin,
  Network,
  Play,
  Server,
  ShieldCheck,
  TicketCheck,
  UserRound,
  Wrench,
} from "lucide-react";
import { api } from "./api";
import { OpenIrisChatButton } from "./OpenIrisChatButton";
import { TechnicalText } from "./ProviderGlossary";
import "./TicketWorkspacePage.css";
import type {
  CustomerDetail,
  IrisContext,
  SupportProfile,
  SupportTicket,
  TicketTriageRun,
  TicketFilter,
} from "./types";

const nocStatusLabel: Record<SupportTicket["noc_status"], string> = {
  not_applicable: "Não se aplica",
  pending: "Aguardando NOC",
  in_progress: "Em análise pelo NOC",
  linked: "Vinculado a incidente",
  closed: "Encerrado pelo NOC",
};

const problemStatusLabel: Record<
  SupportProfile["problemHistory"][number]["status"],
  string
> = {
  open: "Aberto",
  mitigating: "Em mitigação",
  monitoring: "Em observação",
  resolved: "Resolvido",
};

const problemSeverityLabel: Record<
  SupportProfile["problemHistory"][number]["severity"],
  string
> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

function formatDate(value: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function scopeLabel(problem: SupportProfile["problemHistory"][number]) {
  const scope = problem.scope;
  const path = [scope.olt, scope.pon && `PON ${scope.pon}`, scope.cto]
    .filter(Boolean)
    .join(" · ");
  return path || scope.identifier || "Escopo geral";
}

async function loadAllCustomerTickets(customerId: string) {
  const filter: TicketFilter = {
    kind: "customer",
    value: customerId,
    label: customerId,
    detail: "Cliente",
  };
  const first = await api.tickets("", 1, [filter], "opened_at_desc");
  if (first.totalPages <= 1) return first.data;
  const remaining = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, index) =>
      api.tickets("", index + 2, [filter], "opened_at_desc"),
    ),
  );
  return [first, ...remaining]
    .flatMap((page) => page.data)
    .sort(
      (left, right) =>
        new Date(right.opened_at).valueOf() -
        new Date(left.opened_at).valueOf(),
    );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="ticket-workspace-detail-item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function TicketStatus({ status }: { status: SupportTicket["noc_status"] }) {
  return (
    <span className={`ticket-workspace-status ${status}`}>
      <i aria-hidden="true" />
      {nocStatusLabel[status]}
    </span>
  );
}

function RawSourcePayload({
  payload,
}: {
  payload: Record<string, unknown> | undefined;
}) {
  if (!payload || Object.keys(payload).length === 0) return null;
  return (
    <details className="ticket-workspace-raw-payload">
      <summary>Dados brutos da origem (JSON)</summary>
      <pre>{JSON.stringify(payload, null, 2)}</pre>
    </details>
  );
}

export function TicketWorkspacePage({
  ticket,
  canManageNoc = false,
  canOpenAssistant = false,
  onBack,
  onOpenTicket,
  onOpenAssistant,
  onNocQueueChanged,
  onOpenGrouping,
}: {
  ticket: SupportTicket;
  canManageNoc?: boolean;
  onBack: () => void;
  onOpenTicket?: (ticket: SupportTicket) => void;
  canOpenAssistant?: boolean;
  onOpenAssistant?: (context: IrisContext) => void;
  onNocQueueChanged?: () => void | Promise<void>;
  onOpenGrouping?: (ticket: SupportTicket) => void;
}) {
  const [currentTicket, setCurrentTicket] = useState(ticket);
  const [profile, setProfile] = useState<SupportProfile | null>(null);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [allTickets, setAllTickets] = useState<SupportTicket[]>([]);
  const [triageRuns, setTriageRuns] = useState<TicketTriageRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCurrentTicket(ticket);
    let canceled = false;
    setLoading(true);
    setError("");
    setProfile(null);
    setCustomer(null);
    setAllTickets([]);
    setTriageRuns([]);
    void Promise.all([
      api.support(ticket.customer_id),
      api.customer(ticket.customer_id),
      loadAllCustomerTickets(ticket.customer_id),
      api.ticket(ticket.ticket_id),
      api.ticketTriage(ticket.ticket_id),
    ])
      .then(
        ([
          nextProfile,
          nextCustomer,
          nextTickets,
          detailedTicket,
          nextTriageRuns,
        ]) => {
          if (canceled) return;
          setProfile(nextProfile);
          setCustomer(nextCustomer);
          setAllTickets(nextTickets);
          setCurrentTicket(detailedTicket);
          setTriageRuns(nextTriageRuns);
        },
      )
      .catch((reason) => {
        if (!canceled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível consolidar a ficha do ticket.",
          );
        }
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [ticket]);

  async function updateNocStatus(status: "in_progress" | "closed") {
    if (
      status === "closed" &&
      !window.confirm(
        `Encerrar a análise do ticket ${currentTicket.ticket_id}? O histórico será preservado.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const updated = await api.updateNocTicketStatus(
        currentTicket.ticket_id,
        status,
      );
      setCurrentTicket((previous) => ({
        ...previous,
        noc_status: updated.noc_status,
      }));
      setAllTickets((previous) =>
        previous.map((item) =>
          item.ticket_id === currentTicket.ticket_id
            ? { ...item, noc_status: updated.noc_status }
            : item,
        ),
      );
      await onNocQueueChanged?.();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível atualizar a situação do ticket.",
      );
    } finally {
      setBusy(false);
    }
  }

  const activeEquipment = customer?.equipment_history.find(
    (item) => item.status === "active",
  );
  const linkedToOperationalIncident = Boolean(
    currentTicket.related_problem_id?.toUpperCase().startsWith("INC-"),
  );

  function openTicketChat(problemId = currentTicket.related_problem_id) {
    onOpenAssistant?.({
      view: "Tickets",
      entity: "ticket",
      selection: `${currentTicket.ticket_id} · ${currentTicket.category} · ${currentTicket.description}`,
      ticketId: currentTicket.ticket_id,
      problemId: problemId ?? undefined,
      customerId: currentTicket.customer_id,
      serial: profile?.equipment.serial,
    });
  }

  return (
    <section className="ticket-workspace-page">
      <header className="ticket-workspace-toolbar">
        <button
          type="button"
          className="ticket-workspace-back"
          onClick={onBack}
        >
          <ArrowLeft size={16} /> Voltar para a fila de tickets
        </button>
        <div className="ticket-workspace-toolbar-actions">
          <TicketStatus status={currentTicket.noc_status} />
          {canOpenAssistant && onOpenAssistant && (
            <OpenIrisChatButton onClick={() => openTicketChat()} compact />
          )}
          {canManageNoc &&
            onOpenGrouping &&
            !linkedToOperationalIncident &&
            ["pending", "in_progress"].includes(currentTicket.noc_status) && (
              <button
                type="button"
                className="ticket-workspace-group-action"
                disabled={busy}
                onClick={() => onOpenGrouping(currentTicket)}
                title="Abra o formulário do NOC já preenchido com o cliente e a topologia deste ticket."
              >
                <Network size={15} /> Confirmar problema compartilhado
              </button>
            )}
          {canManageNoc &&
            ["pending", "in_progress"].includes(currentTicket.noc_status) && (
              <button
                type="button"
                className="ticket-workspace-action"
                disabled={busy}
                onClick={() =>
                  void updateNocStatus(
                    currentTicket.noc_status === "pending"
                      ? "in_progress"
                      : "closed",
                  )
                }
              >
                {currentTicket.noc_status === "pending" ? (
                  <Play size={15} />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                {busy
                  ? "Atualizando…"
                  : currentTicket.noc_status === "pending"
                    ? "Iniciar análise"
                    : "Encerrar este ticket"}
              </button>
            )}
        </div>
      </header>

      <header className="ticket-workspace-hero">
        <div>
          <span className="section-label">Ficha completa do chamado</span>
          <h1>{currentTicket.ticket_id}</h1>
          <p>
            {currentTicket.category} · cliente {currentTicket.customer_id} ·
            aberto em {formatDate(currentTicket.opened_at)}
          </p>
        </div>
        <div className="ticket-workspace-hero-summary">
          <div>
            <span>Relato</span>
            <strong>{currentTicket.description}</strong>
          </div>
          <div>
            <span>Destino atual</span>
            <strong>{currentTicket.resolution}</strong>
          </div>
        </div>
      </header>

      {error && (
        <div className="ticket-workspace-error" role="alert">
          <AlertTriangle size={17} /> {error}
        </div>
      )}

      {loading && (
        <div className="ticket-workspace-loading" role="status">
          <span /> Consolidando cadastro, equipamento, chamados e problemas…
        </div>
      )}

      {profile && customer && (
        <>
          <section className="ticket-workspace-context-grid">
            <article className="ticket-workspace-context-card customer">
              <div className="ticket-workspace-context-icon">
                <UserRound size={20} />
              </div>
              <div>
                <span className="section-label">Cliente</span>
                <h2>{profile.customer.id}</h2>
                <p>
                  <MapPin size={13} /> {profile.customer.neighborhood} ·{" "}
                  {profile.customer.city}
                </p>
                <dl>
                  <DetailItem
                    label="Situação"
                    value={
                      customer.customer.customer_status === "active"
                        ? "Ativo"
                        : customer.customer.customer_status
                    }
                  />
                  <DetailItem
                    label="Cliente desde"
                    value={formatShortDate(customer.customer.customer_since)}
                  />
                </dl>
              </div>
            </article>

            <article className="ticket-workspace-context-card equipment">
              <div className="ticket-workspace-context-icon">
                <Cpu size={20} />
              </div>
              <div>
                <span className="section-label">Equipamento ativo</span>
                <h2>
                  {profile.equipment.vendor} {profile.equipment.model}
                </h2>
                <p>
                  <Network size={13} /> {profile.equipment.network}
                </p>
                <dl>
                  <DetailItem label="Serial" value={profile.equipment.serial} />
                  <DetailItem
                    label="Firmware / hardware"
                    value={`${profile.equipment.firmware} · ${profile.equipment.hardware}`}
                  />
                  <DetailItem
                    label="Plano atual"
                    value={`${profile.equipment.planMbps} Mbps`}
                  />
                </dl>
              </div>
            </article>
          </section>

          <section className="ticket-workspace-main-grid">
            <article className="ticket-workspace-card ticket-workspace-ticket-card">
              <header className="ticket-workspace-section-heading">
                <div>
                  <span className="section-label">Registro do atendimento</span>
                  <h2>O que foi relatado neste ticket</h2>
                </div>
                <TicketCheck size={21} />
              </header>
              <dl className="ticket-workspace-details-grid">
                <DetailItem label="Cliente" value={currentTicket.customer_id} />
                <DetailItem label="Categoria" value={currentTicket.category} />
                <DetailItem label="Canal" value={currentTicket.channel} />
                <DetailItem
                  label="Origem"
                  value={
                    currentTicket.source === "n1"
                      ? "Aberto pelo N1"
                      : "Histórico importado"
                  }
                />
                <DetailItem
                  label="Responsável pela abertura"
                  value={currentTicket.opened_by ?? "Não informado"}
                />
                <DetailItem
                  label="Tempo de atendimento"
                  value={
                    currentTicket.handling_minutes == null
                      ? "Em aberto"
                      : `${currentTicket.handling_minutes} min`
                  }
                />
                <DetailItem
                  label="Aberto em"
                  value={formatDate(currentTicket.opened_at)}
                />
                <DetailItem
                  label="Encerrado em"
                  value={formatDate(currentTicket.closed_at)}
                />
                <DetailItem
                  label="Topologia relacionada"
                  value={
                    currentTicket.olt && currentTicket.pon && currentTicket.cto
                      ? `${currentTicket.olt} · PON ${currentTicket.pon} · ${currentTicket.cto}`
                      : "Não informada"
                  }
                />
                <DetailItem
                  label="Problema vinculado"
                  value={
                    currentTicket.related_problem_id ??
                    "Nenhum incidente vinculado"
                  }
                />
              </dl>
              <div className="ticket-workspace-description">
                <span>Motivo relatado pelo cliente</span>
                <p>{currentTicket.description}</p>
              </div>
              <div className="ticket-workspace-description resolution">
                <span>Resolução ou encaminhamento registrado</span>
                <p>{currentTicket.resolution}</p>
              </div>
              <RawSourcePayload payload={currentTicket.source_payload} />
            </article>

            <aside className="ticket-workspace-card ticket-workspace-diagnosis">
              <header className="ticket-workspace-section-heading">
                <div>
                  <span className="section-label">Leitura operacional</span>
                  <h2>O que ajuda a resolver</h2>
                </div>
                <ShieldCheck size={21} />
              </header>
              <span className="ticket-workspace-diagnosis-label">
                Hipótese atual · confiança{" "}
                {profile.decision.confidence.toLowerCase()}
              </span>
              <h3>
                <TechnicalText text={profile.decision.issue} />
              </h3>
              <div className="ticket-workspace-next-action">
                <span>Próximo passo</span>
                <strong>
                  <TechnicalText text={profile.decision.actionLabel} />
                </strong>
              </div>
              <div className="ticket-workspace-script">
                <span>Fala sugerida para o cliente</span>
                <p>“{profile.decision.sayToCustomer}”</p>
              </div>
              <ol className="ticket-workspace-steps">
                {profile.decision.operatorSteps.map((step) => (
                  <li key={step}>
                    <CheckCircle2 size={14} /> <TechnicalText text={step} />
                  </li>
                ))}
              </ol>
            </aside>
          </section>

          {currentTicket.ai_triage_status !== "unprocessed" && (
            <section className="ticket-workspace-section ticket-workspace-ai-triage">
              <header className="ticket-workspace-section-heading">
                <div>
                  <span className="section-label">Triagem automática</span>
                  <h2>Leitura do atendimento e separação N1/NOC</h2>
                </div>
                <ShieldCheck size={21} />
              </header>
              <div className="ticket-workspace-ai-summary">
                <div>
                  <span>Status da análise</span>
                  <strong>
                    {currentTicket.ai_triage_status === "completed"
                      ? "Concluída"
                      : currentTicket.ai_triage_status === "needs_review"
                        ? "Aguardando revisão humana"
                        : currentTicket.ai_triage_status === "failed"
                          ? "Falhou"
                          : "Em análise"}
                  </strong>
                </div>
                <div>
                  <span>Categoria do atendimento</span>
                  <strong>
                    {currentTicket.ai_triage_category ??
                      "Ainda não classificada"}
                  </strong>
                </div>
                <div>
                  <span>Destino operacional</span>
                  <strong>
                    {triageRuns[0]?.case_scope === "shared" ||
                    triageRuns[0]?.noc_candidate
                      ? "Candidato a problema NOC"
                      : "Atendimento individual N1"}
                  </strong>
                </div>
                <div>
                  <span>Confiança</span>
                  <strong>
                    {currentTicket.ai_triage_confidence == null
                      ? "Não informada"
                      : `${Math.round(currentTicket.ai_triage_confidence * 100)}%`}
                  </strong>
                </div>
              </div>
              {currentTicket.ai_triage_reason && (
                <p className="ticket-workspace-ai-reason">
                  {currentTicket.ai_triage_reason}
                </p>
              )}
              {triageRuns[0]?.noc_reason && (
                <p className="ticket-workspace-ai-noc-reason">
                  <strong>Leitura para o NOC:</strong>{" "}
                  {triageRuns[0].noc_reason}
                </p>
              )}
              {triageRuns[0]?.evidence?.length > 0 && (
                <ul className="ticket-workspace-ai-evidence">
                  {triageRuns[0].evidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              <p className="ticket-workspace-ai-footnote">
                O ticket continua sendo do atendimento N1. Quando houver
                evidência compartilhada, ele apenas entra na fila do NOC; a
                confirmação do incidente e o agrupamento de outros tickets são
                decisões do NOC.
              </p>
            </section>
          )}

          <section className="ticket-workspace-section">
            <header className="ticket-workspace-section-heading">
              <div>
                <span className="section-label">Histórico completo</span>
                <h2>Todos os chamados deste cliente</h2>
              </div>
              <strong className="ticket-workspace-count">
                {allTickets.length} chamados
              </strong>
            </header>
            {allTickets.length > 0 ? (
              <div className="ticket-workspace-history-list">
                {allTickets.map((item) => (
                  <article
                    className={`ticket-workspace-history-entry ${item.ticket_id === currentTicket.ticket_id ? "current" : ""}`}
                    key={item.ticket_id}
                  >
                    <div className="ticket-workspace-history-date">
                      <Clock3 size={14} />
                      <span>{formatShortDate(item.opened_at)}</span>
                    </div>
                    <div className="ticket-workspace-history-main">
                      <div className="ticket-workspace-history-title">
                        <button
                          type="button"
                          onClick={() => onOpenTicket?.(item)}
                          disabled={item.ticket_id === currentTicket.ticket_id}
                        >
                          {item.ticket_id} <ChevronRight size={14} />
                        </button>
                        <span className="ticket-category">{item.category}</span>
                        <TicketStatus status={item.noc_status} />
                      </div>
                      <p>{item.description}</p>
                      <small>{item.resolution}</small>
                    </div>
                    <div className="ticket-workspace-history-meta">
                      <span>{item.channel}</span>
                      <strong>
                        {item.handling_minutes == null
                          ? "Em aberto"
                          : `${item.handling_minutes} min`}
                      </strong>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="ticket-workspace-empty">
                Nenhum outro chamado encontrado para este cliente.
              </p>
            )}
          </section>

          <section className="ticket-workspace-two-column">
            <article className="ticket-workspace-section">
              <header className="ticket-workspace-section-heading">
                <div>
                  <span className="section-label">Correlação de problemas</span>
                  <h2>Todos os problemas relacionados</h2>
                </div>
                <Wrench size={21} />
              </header>
              {profile.problemHistory.length > 0 ? (
                <div className="ticket-workspace-problem-list">
                  {profile.problemHistory.map((problem) => (
                    <article key={problem.incidentId}>
                      <div className="ticket-workspace-problem-heading">
                        <div>
                          <strong>{problem.incidentId}</strong>
                          <h3>
                            <TechnicalText text={problem.title} />
                          </h3>
                        </div>
                        <span
                          className={`ticket-workspace-problem-severity ${problem.severity}`}
                        >
                          {problemSeverityLabel[problem.severity]}
                        </span>
                      </div>
                      <div className="ticket-workspace-problem-meta">
                        <span>{problemStatusLabel[problem.status]}</span>
                        <span>{scopeLabel(problem)}</span>
                        <span>
                          {problem.affectedCpes.toLocaleString("pt-BR")} CPEs
                        </span>
                        <span>{formatShortDate(problem.openedAt)}</span>
                      </div>
                      {canOpenAssistant && onOpenAssistant && (
                        <OpenIrisChatButton
                          compact
                          label="Conversar sobre este problema"
                          onClick={() => openTicketChat(problem.incidentId)}
                        />
                      )}
                      <p>
                        <strong>Causa provável:</strong> {problem.probableCause}
                      </p>
                      <small>
                        <strong>Próxima ação:</strong>{" "}
                        {problem.recommendedAction}
                      </small>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="ticket-workspace-empty">
                  Nenhum problema relacionado foi encontrado no histórico
                  operacional.
                </p>
              )}
            </article>

            <article className="ticket-workspace-section ticket-workspace-signals">
              <header className="ticket-workspace-section-heading">
                <div>
                  <span className="section-label">Evidências recentes</span>
                  <h2>Sinais do equipamento</h2>
                </div>
                <Activity size={21} />
              </header>
              <div className="ticket-workspace-signal-grid">
                <div>
                  <span>Memória mínima</span>
                  <strong>
                    {profile.metrics.mem_min_pct == null
                      ? "n/d"
                      : `${profile.metrics.mem_min_pct}%`}
                  </strong>
                </div>
                <div>
                  <span>Reinícios</span>
                  <strong>{profile.metrics.reboot_count}</strong>
                </div>
                <div>
                  <span>Sinal óptico</span>
                  <strong>
                    {profile.metrics.optical_rx_min_dbm == null
                      ? "n/d"
                      : `${profile.metrics.optical_rx_min_dbm} dBm`}
                  </strong>
                </div>
                <div>
                  <span>Porta LAN</span>
                  <strong>
                    {profile.metrics.lan_min_mbps == null
                      ? "n/d"
                      : `${profile.metrics.lan_min_mbps} Mbps`}
                  </strong>
                </div>
                <div>
                  <span>Wi-Fi médio</span>
                  <strong>
                    {profile.metrics.wifi_signal_raw == null
                      ? "n/d"
                      : `${profile.metrics.wifi_signal_raw} dBm`}
                  </strong>
                </div>
                <div>
                  <span>Último dia</span>
                  <strong>{formatShortDate(profile.metrics.last_day)}</strong>
                </div>
              </div>
              {profile.metrics.diagnostic && (
                <div className="ticket-workspace-diagnostic">
                  <span>Último diagnóstico ACS</span>
                  <strong>{profile.metrics.diagnostic.state}</strong>
                  <small>
                    {profile.metrics.diagnostic.download_mbps == null
                      ? "Sem download válido"
                      : `${profile.metrics.diagnostic.download_mbps} Mbps de download · ${Math.round((profile.metrics.diagnostic.ratio ?? 0) * 100)}% do plano`}
                  </small>
                </div>
              )}
            </article>
          </section>

          <section className="ticket-workspace-section">
            <header className="ticket-workspace-section-heading">
              <div>
                <span className="section-label">Inventário do cliente</span>
                <h2>Histórico de equipamentos</h2>
              </div>
              <Server size={21} />
            </header>
            <div className="ticket-workspace-equipment-list">
              {customer.equipment_history.map((equipment) => (
                <article
                  key={`${equipment.serial}-${equipment.installed_at}`}
                  className={equipment.status === "active" ? "active" : ""}
                >
                  <div className="ticket-workspace-equipment-icon">
                    <Cpu size={17} />
                  </div>
                  <div>
                    <strong>
                      {equipment.vendor} {equipment.model}
                    </strong>
                    <span>
                      {equipment.serial} · fw {equipment.software_version} · hw{" "}
                      {equipment.hw_revision}
                    </span>
                  </div>
                  <div>
                    <span>
                      {equipment.olt} · PON {equipment.pon_port} ·{" "}
                      {equipment.cto}
                    </span>
                    <small>
                      {equipment.city} · {equipment.neighborhood}
                    </small>
                  </div>
                  <span
                    className={`ticket-workspace-equipment-status ${equipment.status}`}
                  >
                    {equipment.status === "active" ? "Ativo" : "Removido"}
                  </span>
                </article>
              ))}
            </div>
            {!activeEquipment && (
              <p className="ticket-workspace-empty">
                Não há equipamento ativo no inventário atual.
              </p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
