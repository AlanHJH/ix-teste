import { FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  Clock3,
  Play,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  X,
} from "lucide-react";
import { api } from "./api";
import { HelpTooltip } from "./HelpTooltip";
import { ProviderTerm, TechnicalText } from "./ProviderGlossary";
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
  reviewer,
  note,
  onNote,
  onReview,
  onRetry,
  busy,
}: {
  investigation: Investigation;
  reviewer: string;
  note: string;
  onNote: (value: string) => void;
  onReview: (decision: "approve" | "reject") => void;
  onRetry: () => void;
  busy: boolean;
}) {
  const finding = investigation.finding;
  return (
    <article className={`investigation-card ${investigation.status}`}>
      <header>
        <div>
          <div className="investigation-tags">
            <span>{triggerLabel[investigation.trigger_type]}</span>
            <span className={`investigation-status ${investigation.status}`}>
              {statusLabel[investigation.status]}
            </span>
          </div>
          <h3>{finding?.title ?? investigation.trigger_label}</h3>
          <small>
            {investigation.investigation_id} ·{" "}
            {formatDate(investigation.created_at)}
          </small>
        </div>
        {finding && (
          <div className="investigation-confidence">
            <strong>{Math.round(finding.confidence * 100)}%</strong>
            <span>
              confiança
              <HelpTooltip
                term="Confiança do agente"
                description="Estimativa do modelo apoiada pelas evidências consultadas. Não substitui a validação do operador."
              />
            </span>
          </div>
        )}
      </header>

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
          <div className="investigation-summary">
            <div>
              <span>Alcance</span>
              <strong>{finding.scope.identifier}</strong>
              <small>{finding.affectedCpes} CPEs estimadas</small>
            </div>
            <div>
              <span>Causa provável</span>
              <strong>
                <TechnicalText text={finding.probableCause} />
              </strong>
            </div>
            <div>
              <span>Ação sugerida</span>
              <strong>
                <TechnicalText text={finding.recommendedAction} />
              </strong>
            </div>
          </div>
          <p className="investigation-explanation">{finding.summary}</p>
          <div className="investigation-evidence">
            <div>
              <span>Evidências favoráveis</span>
              <ul>
                {finding.evidence.map((evidence) => (
                  <li key={`${evidence.source}-${evidence.reference}`}>
                    <Check size={14} />
                    <p>
                      <strong>{evidence.source}</strong> · {evidence.summary}
                      <small>{evidence.reference}</small>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span>Evidências contrárias</span>
              {finding.counterEvidence.length ? (
                <ul>
                  {finding.counterEvidence.map((evidence) => (
                    <li key={`${evidence.source}-${evidence.reference}`}>
                      <SearchCheck size={14} />
                      <p>
                        {evidence.summary}
                        <small>{evidence.reference}</small>
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="investigation-none">Nenhuma registrada.</p>
              )}
            </div>
          </div>
          <details className="tool-trace">
            <summary>
              {investigation.tool_trace.length} consultas{" "}
              <ProviderTerm term="mcp" /> auditadas
            </summary>
            <ol>
              {investigation.tool_trace.map((trace, index) => (
                <li key={`${trace.tool}-${index}`}>
                  <strong>{trace.tool}</strong>
                  <code>{JSON.stringify(trace.arguments)}</code>
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
              Aprovar cria o agrupamento ativo para o NOC e para o contexto do
              N1. Rejeitar preserva o resultado como feedback auditável.
            </p>
          </div>
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
    </article>
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

  return (
    <section
      className={`investigations-page${isNoc ? " noc-investigations" : ""}`}
    >
      {isNoc ? (
        <section className="noc-agent-overview">
          <div className="noc-agent-icon">
            <Bot size={22} />
          </div>
          <div>
            <span className="section-label">Vigilância automática com IA</span>
            <h2>Novos problemas passam pela aprovação do NOC</h2>
            <p>
              A cada {intervalMinutes} minutos, os detectores procuram possíveis
              problemas por parque, OLT, PON, CTO, região, firmware, equipamento
              e cliente. O agente confirma os candidatos consultando o{" "}
              <ProviderTerm term="mcp" /> somente leitura e propõe o menor
              alcance que explique o problema.
            </p>
          </div>
          <div
            className={`automatic-status ${
              page?.meta.config.metricTriggerEnabled && configured
                ? "ready"
                : "paused"
            }`}
          >
            <Clock3 size={17} />
            <div>
              <strong>
                {page?.meta.config.metricTriggerEnabled && configured
                  ? `Ativo · ${intervalMinutes} min`
                  : "Automação pausada"}
              </strong>
              <span>
                Deduplicação e validação humana
                <HelpTooltip
                  term="Deduplicação automática"
                  description="A mesma regra, problema e janela de dados não geram outra investigação. Mesmo quando a IA confirma um problema, só o NOC pode aprovar e criar o agrupamento."
                />
              </span>
            </div>
            <button
              type="button"
              className="noc-agent-run"
              disabled={!configured || Boolean(busy)}
              onClick={() =>
                void run("groupings", api.triggerGroupingInvestigations)
              }
              title="Executa agora os detectores de agrupamento e envia novos candidatos ao agente."
            >
              <SearchCheck size={14} />
              {busy === "groupings" ? "Buscando…" : "Buscar agora"}
            </button>
          </div>
        </section>
      ) : (
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
        {pending > 0 && (
          <label className="reviewer-field">
            Responsável pela decisão
            <input
              value={reviewer}
              onChange={(event) => setReviewer(event.target.value)}
              placeholder="Nome ou matrícula"
            />
          </label>
        )}
        <div className="investigations-list">
          {investigations.map((investigation) => (
            <InvestigationCard
              key={investigation.investigation_id}
              investigation={investigation}
              reviewer={reviewer}
              note={notes[investigation.investigation_id] ?? ""}
              onNote={(value) =>
                setNotes((current) => ({
                  ...current,
                  [investigation.investigation_id]: value,
                }))
              }
              onReview={(decision) => review(investigation, decision)}
              onRetry={() =>
                void run(investigation.investigation_id, () =>
                  api.retryInvestigation(investigation.investigation_id),
                )
              }
              busy={busy === investigation.investigation_id}
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
    </section>
  );
}
