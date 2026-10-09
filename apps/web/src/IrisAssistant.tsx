import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bot,
  ChevronRight,
  Database,
  LoaderCircle,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "./api";
import { globalAssistantEnabled, useAgentPolicy } from "./agentPolicy";
import type { IrisChatMessage, IrisContext, IrisReply } from "./types";

type Props = {
  view: string;
  context?: IrisContext;
  requestKey?: number;
};

type IrisMessage = IrisChatMessage & {
  reply?: IrisReply;
};

const suggestionsByView: Record<string, string[]> = {
  dashboard: [
    "Onde agir primeiro hoje?",
    "O que mudou na última semana?",
    "Resuma os principais riscos do parque.",
  ],
  noc: [
    "Quais agrupamentos têm evidência mais forte?",
    "Qual incidente merece prioridade?",
    "Explique este cenário para o N1.",
  ],
  support: [
    "Como devo investigar este cliente?",
    "Há algum problema coletivo relacionado?",
    "Explique a causa provável em linguagem simples.",
  ],
  topology: [
    "Quais pontos da topologia concentram risco?",
    "Há algum caminho com sinal coletivo?",
    "Como investigar uma PON em alerta?",
  ],
  tickets: [
    "Quais chamados indicam um problema coletivo?",
    "Resuma a fila atual do NOC.",
    "Que padrão aparece nos chamados recentes?",
  ],
  diagnostics: [
    "Quais medições estão fora do esperado?",
    "Existe relação entre memória e reinícios?",
    "Que evidência devo conferir primeiro?",
  ],
  inventory: [
    "Há algum modelo ou firmware concentrando problemas?",
    "Como comparar os equipamentos afetados?",
    "Mostre os principais riscos do inventário.",
  ],
  customers: [
    "Como encontrar clientes dentro de um mesmo problema?",
    "Que dados devo conferir neste cadastro?",
    "Há clientes com histórico de reincidência?",
  ],
  "agent-config": [
    "Quais fontes MCP estão disponíveis?",
    "Como a Íris protege ações operacionais?",
    "O que significa somente leitura aqui?",
  ],
};

const viewLabels: Record<string, string> = {
  dashboard: "Dashboard",
  noc: "Visão NOC",
  support: "Atendimento N1",
  topology: "Infraestrutura de rede",
  tickets: "Tickets",
  diagnostics: "Medições",
  inventory: "Equipamentos",
  customers: "Clientes",
  "agent-config": "Configuração IA",
};

function contextLabel(context: IrisContext) {
  if (context.ticketId) return `ticket ${context.ticketId}`;
  if (context.problemId) return `problema ${context.problemId}`;
  if (context.customerId) return `cliente ${context.customerId}`;
  return "contexto atual";
}

function welcomeMessage(view: string, context: IrisContext): IrisMessage {
  return {
    role: "assistant",
    content: `Sou a Íris. Estou olhando a página ${viewLabels[view] ?? "atual"} e o ${contextLabel(context)}. Posso cruzar dados de clientes, inventário, telemetria, diagnósticos, chamados, topologia e operação pelo MCP. O que você quer investigar?`,
  };
}

function modelLabel(reply: IrisReply) {
  if (reply.model === "openai") return "IA + MCP";
  if (reply.model === "fallback") return "Fallback + MCP";
  return "MCP indisponível";
}

export function IrisAssistant({
  view,
  context: initialContext = {},
  requestKey = 0,
}: Props) {
  const policy = useAgentPolicy();
  const enabled = globalAssistantEnabled(policy);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<IrisMessage[]>(() => [
    welcomeMessage(view, initialContext),
  ]);

  const suggestions = useMemo(
    () =>
      initialContext.ticketId || initialContext.problemId
        ? [
            "Qual é a hipótese mais provável para este caso?",
            "Quais evidências do MCP sustentam essa hipótese?",
            "Qual é a próxima verificação segura?",
          ]
        : (suggestionsByView[view] ?? suggestionsByView.dashboard),
    [initialContext.problemId, initialContext.ticketId, view],
  );

  useEffect(() => {
    if (!enabled) setOpen(false);
  }, [enabled]);

  useEffect(() => {
    setMessages([welcomeMessage(view, initialContext)]);
    setInput("");
    setError("");
  }, [initialContext, requestKey, view]);

  useEffect(() => {
    if (requestKey > 0) setOpen(true);
  }, [requestKey]);

  if (!enabled) return null;

  function openAssistant() {
    setOpen(true);
    setError("");
  }

  async function sendMessage(value: string) {
    const message = value.trim().slice(0, 600);
    if (!message || busy) return;
    const nextMessages: IrisMessage[] = [
      ...messages,
      { role: "user", content: message },
    ];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const context: IrisContext = {
        view: viewLabels[view] ?? view,
        ...initialContext,
      };
      const reply = await api.irisChat(
        message,
        nextMessages.slice(-8).map(({ role, content }) => ({ role, content })),
        context,
      );
      setMessages([
        ...nextMessages,
        { role: "assistant", content: reply.assistantMessage, reply },
      ]);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível consultar a Íris agora.",
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
    <>
      {open && (
        <aside className="iris-drawer" aria-label="Assistente Íris">
          <header className="iris-drawer-header">
            <div className="iris-identity">
              <span className="iris-avatar" aria-hidden="true">
                <Sparkles size={18} />
              </span>
              <div>
                <strong>Íris</strong>
                <span>Inteligência de Rede, Inventário e Suporte</span>
              </div>
            </div>
            <button
              className="iris-close"
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar Íris"
              title="Fechar Íris"
            >
              <X size={18} />
            </button>
          </header>

          <div className="iris-security-note">
            <ShieldCheck size={15} />
            <span>
              Consultas somente leitura pelo MCP. Ações operacionais continuam
              sob confirmação humana.
            </span>
          </div>

          <div className="iris-context">
            <span>Página em foco</span>
            <strong>{viewLabels[view] ?? view}</strong>
            {(initialContext.ticketId || initialContext.problemId) && (
              <small className="iris-context-selection">
                {contextLabel(initialContext)} · contexto priorizado
              </small>
            )}
            <small>
              <Database size={12} /> 7 contextos MCP · dados sob demanda
            </small>
          </div>

          <div className="iris-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div
                className={`iris-message ${message.role}`}
                key={`${message.role}-${index}`}
              >
                <span className="iris-message-avatar" aria-hidden="true">
                  {message.role === "assistant" ? (
                    <Sparkles size={13} />
                  ) : (
                    <Bot size={13} />
                  )}
                </span>
                <div className="iris-message-content">
                  <p>{message.content}</p>
                  {message.reply && (
                    <div className="iris-response-detail">
                      <strong>{message.reply.summary}</strong>
                      {message.reply.evidence.length > 0 && (
                        <ul>
                          {message.reply.evidence.slice(0, 3).map((item) => (
                            <li key={`${item.label}-${item.detail}`}>
                              <span>{item.label}</span>
                              {item.detail}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="iris-response-meta">
                        <span>
                          <Database size={11} /> {modelLabel(message.reply)}
                        </span>
                        <span>
                          {message.reply.sources.length} fonte(s) consultada(s)
                        </span>
                      </div>
                      {message.reply.actionNote && (
                        <small>{message.reply.actionNote}</small>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="iris-thinking" role="status">
                <LoaderCircle size={14} /> Consultando o MCP e organizando as
                evidências…
              </div>
            )}
          </div>

          <div className="iris-suggestions">
            <span>Perguntas rápidas</span>
            {suggestions.map((suggestion) => (
              <button
                type="button"
                key={suggestion}
                onClick={() => void sendMessage(suggestion)}
                disabled={busy}
              >
                <ChevronRight size={13} /> {suggestion}
              </button>
            ))}
          </div>

          <form className="iris-input" onSubmit={submit}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Pergunte à Íris…"
              aria-label="Pergunta para a Íris"
              maxLength={600}
              disabled={busy}
            />
            <button type="submit" disabled={busy || input.trim().length < 2}>
              <Send size={15} />
              Enviar
            </button>
          </form>
          {error && (
            <p className="iris-error" role="alert">
              {error}
            </p>
          )}
          <p className="iris-note">
            A Íris mostra evidências e incertezas. Ela não executa mudanças nem
            substitui a decisão do operador.
          </p>
        </aside>
      )}
      <button
        className={`iris-launcher ${open ? "is-open" : ""}`}
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openAssistant();
          }
        }}
        aria-expanded={open}
        aria-label={open ? "Fechar Íris" : "Abrir Íris"}
        title="Perguntar à Íris"
      >
        {open ? <X size={20} /> : <Sparkles size={20} />}
        <span>{open ? "Fechar" : "Perguntar à Íris"}</span>
      </button>
    </>
  );
}
