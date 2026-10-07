import { FormEvent, useEffect, useId, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronRight,
  Clock3,
  Play,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  X,
} from "lucide-react";
import { api } from "./api";
import { HelpTooltip } from "./HelpTooltip";
import { ProviderTerm } from "./ProviderGlossary";
import type { Investigation, InvestigationPage } from "./types";

const statusLabel: Record<Investigation["status"], string> = {
  queued: "Na fila",
  running: "Agente investigando",
  no_problem: "Sem problema confirmado",
  inconclusive: "Inconclusivo",
  pending_review: "Aguardando humano",
  approved: "Aprovado",
  rejected: "Descartado",
  failed: "Falhou",
};

const triggerLabel = {
  metric: "Detector de grupos",
  schedule: "Agendamento",
  manual: "Operador",
};

const evidenceSourceLabel: Record<string, string> = {
  operations: "Detecção inicial",
  inventory: "Inventário da rede",
  telemetry: "Medições dos equipamentos",
  diagnostics: "Testes técnicos",
  tickets: "Chamados de clientes",
  customers: "Contexto do cliente",
};

const toolLabel: Record<string, string> = {
  operations_list_grouping_candidates: "Detector de agrupamentos",
  inventory_topology: "Inventário e topologia",
  telemetry_list_daily_metrics: "Métricas diárias dos equipamentos",
  diagnostics_list: "Medições técnicas",
  tickets_list: "Chamados de clientes",
  customers_list: "Clientes",
};

const argumentLabel: Record<string, string> = {
  day: "Dia",
  fromDay: "De",
  toDay: "Até",
  firmware: "Firmware",
  softwareVersion: "Firmware",
  olt: "OLT",
  pon: "PON",
  cto: "CTO",
  serial: "Serial",
  query: "Busca",
  limit: "Máximo de resultados",
  page: "Página",
  pageSize: "Itens por página",
  offset: "Após o registro",
  scopeType: "Tipo de agrupamento",
};

function humanizeEvidenceSummary(value: string) {
  return value
    .replace(
      /^Candidato (?:pré-calculado|reporta|registra|indica):?\s*/i,
      "O detector identificou ",
    )
    .replace(/sinal stability\.?/gi, "indícios de instabilidade.")
    .replace(
      /^Nenhum chamado correspondente retornado/i,
      "Não foram encontrados chamados relacionados",
    )
    .replace(
      /^A consulta retornou zero registros/i,
      "Não foram encontrados registros no período consultado",
    )
    .replace(/CPEs afetadas/gi, "CPEs afetados")
    .replace(
      /; ausência de resultado não confirma nem refuta a ([^.]+)\./i,
      ". Isso não confirma nem descarta a $1.",
    );
}

function humanizeAnalysisSummary(value: string) {
  return value.replace(/^Candidato aponta\s*/i, "A análise identificou ");
}

function confidenceDescription(confidence: number) {
  if (confidence >= 0.85)
    return "Evidências fortes, ainda sujeitas à validação";
  if (confidence >= 0.7) return "Evidências moderadas; revise os contrapontos";
  return "Evidências limitadas; exige análise cuidadosa";
}

function recommendedActionSteps(value: string) {
  const pattern = /\b(N1|NOC):\s*/g;
  const matches = Array.from(value.matchAll(pattern));
  if (!matches.length) return [{ label: "Próxima ação", text: value }];

  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? value.length;
    return {
      label: match[1] === "N1" ? "Atendimento N1" : "Equipe NOC",
      text: value.slice(start, end).trim(),
    };
  });
}

function formatToolArgument(key: string, value: unknown) {
  if (value === null || value === undefined || value === "")
    return "Não informado";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  if (key === "scopeType" && value === "firmware") return "Firmware";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  return String(value);
}

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
}

function InvestigationCard({
  investigation,
  onOpen,
}: {
  investigation: Investigation;
  onOpen: () => void;
}) {
  const finding = investigation.finding;
  return (
    <article className={`investigation-card ${investigation.status}`}>
      <button
        type="button"
        className="investigation-card-open"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-label={`Abrir análise: ${finding?.title ?? investigation.trigger_label}`}
      >
        <header>
          <div className="investigation-tags">
            <span>{triggerLabel[investigation.trigger_type]}</span>
            <span className={`investigation-status ${investigation.status}`}>
              {statusLabel[investigation.status]}
            </span>
          </div>
          {finding && (
            <div className="investigation-confidence compact">
              <strong>{Math.round(finding.confidence * 100)}%</strong>
              <span>confiança</span>
            </div>
          )}
        </header>

        <div className="investigation-card-copy">
          <h3>{finding?.title ?? investigation.trigger_label}</h3>
          <small>
            {investigation.investigation_id} ·{" "}
            {formatDate(investigation.created_at)}
          </small>
        </div>

        {finding ? (
          <div className="investigation-card-preview">
            <div>
              <span>Alcance</span>
              <strong>{finding.scope.identifier}</strong>
            </div>
            <div>
              <span>Impacto estimado</span>
              <strong>{finding.affectedCpes} CPEs</strong>
            </div>
            <p>{finding.probableCause}</p>
          </div>
        ) : (
          <p className="investigation-card-objective">
            {investigation.error ?? investigation.objective}
          </p>
        )}

        <footer>
          <span>Ver análise completa</span>
          <ChevronRight size={16} />
        </footer>
      </button>
    </article>
  );
}

function InvestigationDetailModal({
  investigation,
  reviewer,
  onReviewer,
  note,
  onNote,
  onReview,
  onRetry,
  onClose,
  busy,
}: {
  investigation: Investigation;
  reviewer: string;
  onReviewer: (value: string) => void;
  note: string;
  onNote: (value: string) => void;
  onReview: (decision: "approve" | "reject") => void;
  onRetry: () => void;
  onClose: () => void;
  busy: boolean;
}) {
  const finding = investigation.finding;
  const titleId = useId();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="entity-modal-backdrop investigation-modal-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className={`investigation-modal ${investigation.status}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="entity-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Fechar análise"
          title="Fechar análise"
          autoFocus
        >
          <X size={19} />
        </button>

        <header className="investigation-modal-header">
          <div>
            <div className="investigation-tags">
              <span>{triggerLabel[investigation.trigger_type]}</span>
              <span className={`investigation-status ${investigation.status}`}>
                {statusLabel[investigation.status]}
              </span>
            </div>
            <h2 id={titleId}>
              {finding?.title ?? investigation.trigger_label}
            </h2>
            <small>
              {investigation.investigation_id} ·{" "}
              {formatDate(investigation.created_at)}
            </small>
          </div>
          {finding && (
            <div className="investigation-confidence">
              <strong>{Math.round(finding.confidence * 100)}%</strong>
              <span>Confiança estimada</span>
              <small>{confidenceDescription(finding.confidence)}</small>
            </div>
          )}
        </header>

        <div className="investigation-modal-content">
          {!finding && !investigation.error && (
            <p className="investigation-objective">{investigation.objective}</p>
          )}
          {investigation.error && (
            <div className="investigation-error">
              <p>
                <AlertTriangle size={15} /> {investigation.error}
              </p>
              {investigation.status === "failed" && (
                <button disabled={busy} onClick={onRetry}>
                  <RefreshCw size={14} />
                  {busy ? "Reenfileirando…" : "Tentar novamente"}
                </button>
              )}
            </div>
          )}

          {finding && (
            <>
              <div className="investigation-overview">
                <div>
                  <span>Escopo analisado</span>
                  <strong>{finding.scope.identifier}</strong>
                  <small>Menor agrupamento sustentado pelos dados</small>
                </div>
                <div>
                  <span>Impacto estimado</span>
                  <strong>{finding.affectedCpes} CPEs</strong>
                  <small>Equipamentos possivelmente afetados</small>
                </div>
              </div>
              <div className="investigation-conclusion-grid">
                <section>
                  <span>Hipótese levantada pela IA</span>
                  <h3>O que pode estar acontecendo</h3>
                  <p>{finding.probableCause}</p>
                </section>
                <section>
                  <span>Orientação operacional</span>
                  <h3>O que fazer agora</h3>
                  <ol className="investigation-actions-list">
                    {recommendedActionSteps(finding.recommendedAction).map(
                      (step) => (
                        <li key={`${step.label}-${step.text}`}>
                          <strong>{step.label}</strong>
                          <p>{step.text}</p>
                        </li>
                      ),
                    )}
                  </ol>
                </section>
              </div>
              <section className="investigation-rationale">
                <span>Explicação em linguagem simples</span>
                <h3>Como a IA chegou a essa conclusão</h3>
                <p className="investigation-explanation">
                  {humanizeAnalysisSummary(finding.summary)}
                </p>
              </section>
              <div className="investigation-evidence">
                <section>
                  <span>Por que a hipótese faz sentido</span>
                  <p className="investigation-evidence-intro">
                    Sinais encontrados que reforçam a conclusão proposta.
                  </p>
                  <ol>
                    {finding.evidence.map((evidence, index) => (
                      <li key={`${evidence.source}-${evidence.reference}`}>
                        <span className="investigation-evidence-index">
                          {index + 1}
                        </span>
                        <div>
                          <strong>
                            {evidenceSourceLabel[evidence.source] ??
                              "Fonte consultada"}
                          </strong>
                          <p>{humanizeEvidenceSummary(evidence.summary)}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
                <section>
                  <span>O que ainda gera dúvida</span>
                  <p className="investigation-evidence-intro">
                    Limitações que precisam ser consideradas antes da decisão.
                  </p>
                  {finding.counterEvidence.length ? (
                    <ol>
                      {finding.counterEvidence.map((evidence, index) => (
                        <li key={`${evidence.source}-${evidence.reference}`}>
                          <span className="investigation-evidence-index counter">
                            {index + 1}
                          </span>
                          <div>
                            <strong>
                              {evidenceSourceLabel[evidence.source] ??
                                "Fonte consultada"}
                            </strong>
                            <p>{humanizeEvidenceSummary(evidence.summary)}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="investigation-none">
                      A análise não encontrou contrapontos relevantes.
                    </p>
                  )}
                </section>
              </div>
              <details className="tool-trace">
                <summary>
                  Auditoria técnica · {investigation.tool_trace.length}{" "}
                  consultas MCP (opcional)
                </summary>
                <p>
                  Registro das fontes e filtros usados pela IA. Esta seção não é
                  necessária para a decisão operacional.
                </p>
                <ol>
                  {investigation.tool_trace.map((trace, index) => (
                    <li key={`${trace.tool}-${index}`}>
                      <strong>{toolLabel[trace.tool] ?? trace.tool}</strong>
                      <dl>
                        {Object.entries(trace.arguments).map(([key, value]) => (
                          <div key={key}>
                            <dt>{argumentLabel[key] ?? key}</dt>
                            <dd>{formatToolArgument(key, value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </li>
                  ))}
                </ol>
              </details>
            </>
          )}

          {investigation.status === "pending_review" && (
            <div className="human-review">
              <div>
                <ShieldCheck size={19} />
                <p>
                  <strong>Decisão humana obrigatória</strong>
                  Aprovar cria o agrupamento ativo para o NOC e para o contexto
                  do N1. Rejeitar preserva o resultado como feedback auditável.
                </p>
              </div>
              <label className="investigation-modal-reviewer">
                Responsável pela decisão
                <input
                  value={reviewer}
                  onChange={(event) => onReviewer(event.target.value)}
                  placeholder="Nome ou matrícula"
                  maxLength={120}
                />
              </label>
              <textarea
                value={note}
                onChange={(event) => onNote(event.target.value)}
                placeholder="Observação da revisão (opcional)"
                aria-label={`Observação para ${investigation.investigation_id}`}
                maxLength={1000}
              />
              <div className="review-actions">
                <button
                  className="reject"
                  disabled={busy || !reviewer.trim()}
                  onClick={() => onReview("reject")}
                >
                  <X size={15} /> Descartar
                </button>
                <button
                  className="approve"
                  disabled={busy || !reviewer.trim()}
                  onClick={() => onReview("approve")}
                >
                  <Check size={15} /> Aprovar e criar agrupamento
                </button>
              </div>
            </div>
          )}

          {investigation.reviewed_by && (
            <div className="reviewed-by">
              Revisado por <strong>{investigation.reviewed_by}</strong> em{" "}
              {formatDate(investigation.reviewed_at)}
              {investigation.incident_id && ` · ${investigation.incident_id}`}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function InvestigationReview({
  mode = "full",
  onGroupingChanged,
}: {
  mode?: "full" | "noc";
  onGroupingChanged?: () => void;
}) {
  const [page, setPage] = useState<InvestigationPage | null>(null);
  const [objective, setObjective] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [selectedInvestigationId, setSelectedInvestigationId] = useState("");

  async function refresh() {
    try {
      setPage(await api.investigations());
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao consultar");
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 4_000);
    return () => window.clearInterval(timer);
  }, []);

  async function run(key: string, task: () => Promise<unknown>) {
    setBusy(key);
    setError("");
    try {
      await task();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha na operação");
    } finally {
      setBusy("");
    }
  }

  function submitManual(event: FormEvent) {
    event.preventDefault();
    if (objective.trim().length < 10) return;
    void run("manual", async () => {
      await api.triggerManualInvestigation(objective);
      setObjective("");
    });
  }

  function review(
    investigation: Investigation,
    decision: "approve" | "reject",
  ) {
    const verb = decision === "approve" ? "aprovar" : "descartar";
    if (
      !window.confirm(`Confirma ${verb} ${investigation.investigation_id}?`)
    ) {
      return;
    }
    void run(investigation.investigation_id, async () => {
      await api.reviewInvestigation(
        investigation.investigation_id,
        decision,
        reviewer,
        notes[investigation.investigation_id] ?? "",
      );
      if (decision === "approve") onGroupingChanged?.();
    });
  }

  const configured = page?.meta.config.openaiConfigured ?? false;
  const isNoc = mode === "noc";
  const investigations = isNoc
    ? (page?.data.filter(
        (investigation) =>
          investigation.trigger_type === "metric" &&
          ["queued", "running", "pending_review", "failed"].includes(
            investigation.status,
          ),
      ) ?? [])
    : (page?.data ?? []);
  const pending = isNoc
    ? investigations.filter(
        (investigation) => investigation.status === "pending_review",
      ).length
    : (page?.meta.summary.pending_review ?? 0);
  const active = isNoc
    ? investigations.filter((investigation) =>
        ["queued", "running"].includes(investigation.status),
      ).length
    : (page?.meta.summary.queued ?? 0) + (page?.meta.summary.running ?? 0);
  const intervalMinutes = Math.round(
    (page?.meta.config.metricTriggerIntervalMs ?? 300_000) / 60_000,
  );
  const selectedInvestigation = investigations.find(
    (investigation) =>
      investigation.investigation_id === selectedInvestigationId,
  );

  return (
    <section
      className={`investigations-page${isNoc ? " noc-investigations" : ""}`}
    >
      {!isNoc && (
        <section className="investigations-hero">
          <div>
            <span className="section-label">
              Agente OpenAI + <ProviderTerm term="mcp" />
            </span>
            <h1>Investigar primeiro. Agir só depois da revisão.</h1>
            <p>
              Métricas, agenda ou operador iniciam a análise. O agente consulta
              o
              <ProviderTerm term="mcp" /> somente leitura e propõe um incidente;
              nenhuma correção de rede é executada automaticamente.
            </p>
          </div>
          <div className={`agent-config ${configured ? "ready" : "missing"}`}>
            <Bot size={23} />
            <div>
              <strong>
                {configured ? "OpenAI configurada" : "Chave OpenAI pendente"}
              </strong>
              <span>{page?.meta.config.model ?? "carregando…"}</span>
              {page && (
                <span>
                  até {page.meta.config.toolCallBudgets.manual} consultas ·
                  contexto de evidências{" "}
                  {Math.round(page.meta.config.maxContextCharacters / 1000)}
                  mil caracteres
                  <HelpTooltip
                    term="Orçamento adaptativo"
                    description="Investigações manuais podem consultar mais fontes. O agente encerra antes se repetir uma consulta ou atingir o volume máximo de evidências."
                  />
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {!configured && page && (
        <div className="agent-setup-warning">
          <AlertTriangle size={19} />
          <p>
            Defina <code>OPENAI_API_KEY</code> no arquivo <code>.env</code> do
            backend e reinicie o Compose. A chave não deve ser informada nesta
            tela nem commitada no repositório.
          </p>
        </div>
      )}

      {!isNoc && (
        <section className="agent-controls">
          <div className="agent-control-card">
            <span>Métrica</span>
            <h2>Buscar agrupamentos problemáticos</h2>
            <p>
              Procura concentrações por todos os escopos válidos e envia apenas
              candidatos delimitados para investigação.
            </p>
            <button
              disabled={!configured || Boolean(busy)}
              onClick={() =>
                void run("metrics", api.triggerGroupingInvestigations)
              }
            >
              <SearchCheck size={16} />
              {busy === "metrics" ? "Criando…" : "Verificar métricas agora"}
            </button>
          </div>
          <div className="agent-control-card">
            <span>Agenda</span>
            <h2>Revisão temática do parque</h2>
            <p>
              Executa agora o mesmo job que pode ser habilitado por intervalo.
            </p>
            <button
              disabled={!configured || Boolean(busy)}
              onClick={() =>
                void run("schedule", api.triggerScheduledInvestigation)
              }
            >
              <Clock3 size={16} />
              {busy === "schedule" ? "Criando…" : "Executar job agora"}
            </button>
          </div>
          <form className="agent-control-card manual" onSubmit={submitManual}>
            <span>Operador</span>
            <h2>Investigação sob demanda</h2>
            <textarea
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              placeholder="Ex.: investigue se as quedas de hoje estão concentradas por PON ou firmware"
              aria-label="Objetivo da investigação"
              maxLength={600}
            />
            <button
              disabled={
                !configured || Boolean(busy) || objective.trim().length < 10
              }
            >
              <Play size={16} />
              {busy === "manual" ? "Criando…" : "Iniciar investigação"}
            </button>
          </form>
        </section>
      )}

      {error && <p className="investigations-error">{error}</p>}

      <section className="review-queue">
        <header>
          <div>
            <span className="section-label">
              {isNoc ? "Aprovação do NOC" : "Gate operacional"}
            </span>
            <h2>
              {isNoc
                ? "Agrupamentos propostos pelo agente"
                : "Incidentes propostos pelo agente"}
            </h2>
          </div>
          <div className="queue-summary">
            <span>{active} em processamento</span>
            <strong>{pending} aguardando revisão</strong>
            <button
              aria-label="Atualizar fila de investigações"
              title="Atualizar fila"
              onClick={() => void refresh()}
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </header>
        <div className="investigations-list">
          {investigations.map((investigation) => (
            <InvestigationCard
              key={investigation.investigation_id}
              investigation={investigation}
              onOpen={() =>
                setSelectedInvestigationId(investigation.investigation_id)
              }
            />
          ))}
          {page && investigations.length === 0 && (
            <div className="investigations-empty">
              {isNoc ? <ShieldCheck size={34} /> : <Bot size={34} />}
              <h3>
                {isNoc
                  ? "Nenhum problema novo aguardando o NOC"
                  : "Nenhuma investigação executada"}
              </h3>
              <p>
                {isNoc
                  ? `A busca automática roda a cada ${intervalMinutes} minutos e não repete candidatos da mesma janela.`
                  : "Configure a OpenAI e escolha um dos gatilhos acima."}
              </p>
            </div>
          )}
        </div>
      </section>

      {selectedInvestigation && (
        <InvestigationDetailModal
          investigation={selectedInvestigation}
          reviewer={reviewer}
          onReviewer={setReviewer}
          note={notes[selectedInvestigation.investigation_id] ?? ""}
          onNote={(value) =>
            setNotes((current) => ({
              ...current,
              [selectedInvestigation.investigation_id]: value,
            }))
          }
          onReview={(decision) => review(selectedInvestigation, decision)}
          onRetry={() =>
            void run(selectedInvestigation.investigation_id, () =>
              api.retryInvestigation(selectedInvestigation.investigation_id),
            )
          }
          onClose={() => setSelectedInvestigationId("")}
          busy={busy === selectedInvestigation.investigation_id}
        />
      )}
    </section>
  );
}
