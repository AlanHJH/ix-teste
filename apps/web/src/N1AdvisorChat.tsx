import { FormEvent, useEffect, useState } from "react";
import {
  Bot,
  Check,
  ChevronRight,
  MessageCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { api } from "./api";
import { DEEP_ANALYSIS_PROMPT, DeepAnalysisPanel } from "./DeepAnalysisPanel";
import type {
  N1AdvisorReply,
  N1ChatMessage,
  N1DeepAnalysis,
  SupportProfile,
} from "./types";
import { HelpTooltip } from "./HelpTooltip";
import { TechnicalText } from "./ProviderGlossary";

type Outcome = "resolver_telefone" | "escalar_noc" | "agendar_visita";

type Props = {
  customerId: string;
  profile: SupportProfile;
  onDocumentationChange: (value: string) => void;
  onOutcomeChange: (value: Outcome) => void;
};

const dispositionToOutcome: Record<N1AdvisorReply["disposition"], Outcome> = {
  continue: "escalar_noc",
  resolve_phone: "resolver_telefone",
  escalate_noc: "escalar_noc",
  schedule_visit: "agendar_visita",
};

function initialMessage(profile: SupportProfile): N1ChatMessage {
  const group = profile.activeIncidents[0];
  return {
    role: "assistant",
    content: group
      ? `O provável problema é ${profile.decision.issue}. O cliente está dentro do agrupamento ativo ${group.incidentId} — ${group.title}, então vou priorizar perguntas simples e evitar repetir diagnósticos. O que o cliente respondeu ou pediu?`
      : `O provável problema é ${profile.decision.issue} (${profile.decision.confidence.toLowerCase()} confiança). Tenho o equipamento, os sinais recentes e ${profile.recentTickets.length} chamado(s) no contexto. O que o cliente respondeu ou pediu?`,
  };
}

export function N1AdvisorChat({
  customerId,
  profile,
  onDocumentationChange,
  onOutcomeChange,
}: Props) {
  const [messages, setMessages] = useState<N1ChatMessage[]>(() => [
    initialMessage(profile),
  ]);
  const [input, setInput] = useState("");
  const [reply, setReply] = useState<N1AdvisorReply | null>(null);
  const [analysis, setAnalysis] = useState<N1DeepAnalysis | null>(null);
  const [analysisBusy, setAnalysisBusy] = useState(true);
  const [analysisError, setAnalysisError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMessages([initialMessage(profile)]);
    setReply(null);
    setAnalysis(null);
    setAnalysisBusy(true);
    setAnalysisError("");
    setInput("");
    setError("");

    let cancelled = false;
    void api
      .n1Chat(customerId, DEEP_ANALYSIS_PROMPT, [])
      .then((nextReply) => {
        if (!cancelled) setAnalysis(nextReply.deepAnalysis);
      })
      .catch((reason) => {
        if (!cancelled) {
          setAnalysisError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível montar a análise profunda.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setAnalysisBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, profile]);

  async function sendMessage(value: string) {
    const message = value.trim().slice(0, 600);
    if (!message || busy) return;
    const nextMessages = [
      ...messages,
      { role: "user" as const, content: message },
    ];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const nextReply = await api.n1Chat(customerId, message, messages);
      setReply(nextReply);
      setAnalysis(nextReply.deepAnalysis);
      setMessages([
        ...nextMessages,
        { role: "assistant", content: nextReply.assistantMessage },
      ]);
      onDocumentationChange(nextReply.documentation);
      onOutcomeChange(dispositionToOutcome[nextReply.disposition]);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível consultar o copiloto N1",
      );
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <section className="n1-advisor-chat panel">
      <header className="n1-advisor-header">
        <div>
          <span className="section-label">Copiloto do atendimento</span>
          <h2>Conduza a ligação com a IA</h2>
          <p>
            Registre a resposta do cliente; a IA atualiza a hipótese, sugere a
            próxima pergunta e prepara a documentação do chamado.
          </p>
        </div>
        <div
          className="n1-advisor-badge"
          title="A IA recomenda; o atendente decide e confirma."
        >
          <Bot size={18} />
          <span>IA + decisão humana</span>
        </div>
      </header>

      <div className="n1-advisor-context" aria-label="Contexto usado pela IA">
        <div>
          <span>Equipamento</span>
          <strong>
            {profile.equipment.vendor} {profile.equipment.model} · fw{" "}
            {profile.equipment.firmware}
          </strong>
        </div>
        <div>
          <span>Rede</span>
          <strong>{profile.equipment.network}</strong>
        </div>
        <div>
          <span>Grupos NOC</span>
          <strong>
            {profile.activeIncidents.length > 0
              ? `${profile.activeIncidents.length} ativo(s)`
              : "Nenhum ativo"}
            <HelpTooltip
              term="Grupos NOC"
              description="Agrupamentos confirmados pelo NOC que alcançam este cliente. Eles têm prioridade sobre uma hipótese isolada."
            />
          </strong>
        </div>
        <div>
          <span>Chamados recentes</span>
          <strong>{profile.recentTickets.length}</strong>
        </div>
      </div>

      {profile.activeIncidents.length > 0 && (
        <div className="n1-advisor-incidents">
          {profile.activeIncidents.slice(0, 3).map((incident) => (
            <div key={incident.incidentId}>
              <ShieldCheck size={15} />
              <span>
                <strong>{incident.incidentId}</strong> ·{" "}
                <TechnicalText text={incident.title} />
                <small>
                  {incident.affectedCpes.toLocaleString("pt-BR")} CPEs ·{" "}
                  {incident.probableCause}
                </small>
              </span>
            </div>
          ))}
        </div>
      )}

      <DeepAnalysisPanel
        analysis={analysis}
        loading={analysisBusy}
        error={analysisError}
      />

      <div className="n1-chat-messages" aria-live="polite">
        {messages.map((message, index) => (
          <div
            className={`n1-chat-message ${message.role}`}
            key={`${message.role}-${index}`}
          >
            <span className="n1-chat-avatar">
              {message.role === "assistant" ? (
                <Bot size={15} />
              ) : (
                <MessageCircle size={15} />
              )}
            </span>
            <p>{message.content}</p>
          </div>
        ))}
        {busy && (
          <div className="n1-chat-thinking" role="status">
            <Bot size={15} /> Consultando contexto e preparando o próximo passo…
          </div>
        )}
      </div>

      {reply && (
        <div className="n1-advisor-next-step">
          <div>
            <span className="section-label">Próximo passo plausível</span>
            <ol>
              {reply.nextSteps.map((step) => (
                <li key={step}>
                  <Check size={14} /> {step}
                </li>
              ))}
            </ol>
          </div>
          <div className="n1-advisor-options">
            <span>Registrar resposta rápida</span>
            {reply.options.map((option) => (
              <button
                type="button"
                key={option.id}
                title={option.description}
                onClick={() => void sendMessage(option.label)}
                disabled={busy}
              >
                <ChevronRight size={14} /> {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <form className="n1-advisor-input" onSubmit={submit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ex.: o cliente disse que o LED LOS ficou vermelho…"
          aria-label="Resposta ou relato do cliente para a IA"
          maxLength={600}
          disabled={busy}
        />
        <button type="submit" disabled={busy || input.trim().length < 2}>
          <Send size={15} />
          Enviar
        </button>
      </form>
      {error && <p className="n1-advisor-error">{error}</p>}
      <p className="n1-advisor-note">
        A IA não executa ações nem promete prazos. O atendente confirma a
        orientação e decide se resolve, escala ou agenda.
      </p>
    </section>
  );
}
