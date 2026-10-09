import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bot,
  BarChart3,
  ChevronRight,
  Database,
  LoaderCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Table2,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "./api";
import { globalAssistantEnabled, useAgentPolicy } from "./agentPolicy";
import type {
  IrisChatMessage,
  IrisContext,
  IrisReply,
  IrisVisualization,
} from "./types";

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
    "Como o Agente IA protege ações operacionais?",
    "O que significa somente leitura aqui?",
  ],
};

const openEndedSuggestions = [
  "Monte um resumo com os principais indicadores.",
  "Compare os principais grupos encontrados.",
  "Mostre uma tendência em gráfico.",
];

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

const visualizationNumber = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

function visualizationValue(value: number, unit: string) {
  return `${visualizationNumber.format(value)}${unit ? ` ${unit}` : ""}`;
}

function visualizationTooltipValue(value: unknown, unit: string) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number)
    ? visualizationValue(number, unit)
    : String(value ?? "—");
}

function AgentVisualization({
  visualization,
}: {
  visualization: IrisVisualization;
}) {
  const chartData = visualization.points.map((point) => ({
    name: point.label,
    value: point.value,
    secondaryValue: point.secondaryValue,
  }));
  const hasSecondary =
    Boolean(visualization.secondaryLabel) &&
    visualization.points.some((point) => point.secondaryValue !== 0);
  const icon =
    visualization.kind === "kpi" ? <GaugeIcon /> : <BarChart3 size={15} />;

  return (
    <section className="iris-visualization">
      <header className="iris-visualization-header">
        <span className="iris-visualization-icon" aria-hidden="true">
          {icon}
        </span>
        <div>
          <strong>{visualization.title}</strong>
          <small>{visualization.description}</small>
        </div>
      </header>
      {visualization.kind === "kpi" ? (
        <div className="iris-kpi-grid">
          {visualization.points.map((point) => (
            <div className="iris-kpi-card" key={point.label}>
              <span>{point.label}</span>
              <strong>
                {visualizationValue(point.value, visualization.unit)}
              </strong>
            </div>
          ))}
        </div>
      ) : visualization.kind === "table" ? (
        <div className="iris-table-scroll">
          <table className="iris-data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>{visualization.primaryLabel || "Valor"}</th>
                {hasSecondary && <th>{visualization.secondaryLabel}</th>}
              </tr>
            </thead>
            <tbody>
              {visualization.points.map((point) => (
                <tr key={point.label}>
                  <td title={point.detail}>{point.label}</td>
                  <td>{visualizationValue(point.value, visualization.unit)}</td>
                  {hasSecondary && (
                    <td>
                      {visualizationValue(
                        point.secondaryValue,
                        visualization.unit,
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="iris-visualization-chart">
          <ResponsiveContainer width="100%" height="100%">
            {visualization.kind === "line" ? (
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#d8e8e6"
                  strokeDasharray="4 4"
                />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  fontSize={9}
                />
                <YAxis tickLine={false} axisLine={false} fontSize={9} />
                <Tooltip
                  formatter={(value) =>
                    visualizationTooltipValue(value, visualization.unit)
                  }
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={visualization.primaryLabel || "Valor"}
                  stroke="#168476"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                {hasSecondary && (
                  <Line
                    type="monotone"
                    dataKey="secondaryValue"
                    name={visualization.secondaryLabel}
                    stroke="#d77a66"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                )}
              </LineChart>
            ) : (
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#d8e8e6"
                  strokeDasharray="4 4"
                />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  fontSize={9}
                />
                <YAxis tickLine={false} axisLine={false} fontSize={9} />
                <Tooltip
                  formatter={(value) =>
                    visualizationTooltipValue(value, visualization.unit)
                  }
                />
                <Bar
                  dataKey="value"
                  name={visualization.primaryLabel || "Valor"}
                  fill="#168476"
                  radius={[4, 4, 0, 0]}
                />
                {hasSecondary && (
                  <Bar
                    dataKey="secondaryValue"
                    name={visualization.secondaryLabel}
                    fill="#d77a66"
                    radius={[4, 4, 0, 0]}
                  />
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function GaugeIcon() {
  return <span className="iris-gauge-icon">%</span>;
}

function contextLabel(context: IrisContext) {
  if (context.technicalTerm) return `termo técnico ${context.technicalTerm}`;
  if (context.ticketId) return `ticket ${context.ticketId}`;
  if (context.problemId) return `problema ${context.problemId}`;
  if (context.customerId) return `cliente ${context.customerId}`;
  return "contexto atual";
}

function welcomeMessage(view: string, context: IrisContext): IrisMessage {
  return {
    role: "assistant",
    content: `Sou o Agente IA. Estou olhando a página ${viewLabels[view] ?? "atual"} e o ${contextLabel(context)}. Posso cruzar dados de clientes, inventário, telemetria, diagnósticos, chamados, topologia e operação pelo MCP. O que você quer investigar?`,
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

  const suggestions = useMemo(() => {
    const contextual = initialContext.technicalTerm
      ? [
          `Explique ${initialContext.technicalTerm} nesta tela.`,
          "Quais sinais devo conferir junto com este dado?",
          "Que erro de interpretação devo evitar?",
        ]
      : initialContext.ticketId || initialContext.problemId
        ? [
            "Qual é a hipótese mais provável para este caso?",
            "Quais evidências do MCP sustentam essa hipótese?",
            "Qual é a próxima verificação segura?",
          ]
        : (suggestionsByView[view] ?? suggestionsByView.dashboard);
    return Array.from(new Set([...contextual, ...openEndedSuggestions])).slice(
      0,
      6,
    );
  }, [
    initialContext.problemId,
    initialContext.technicalTerm,
    initialContext.ticketId,
    view,
  ]);

  const generatedSuggestions = useMemo(() => {
    const latestReply = [...messages]
      .reverse()
      .find((message) => message.reply)?.reply;
    return Array.from(
      new Set([...(latestReply?.suggestedQuestions ?? []), ...suggestions]),
    ).slice(0, 6);
  }, [messages, suggestions]);

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

  useEffect(() => {
    if (requestKey <= 0 || !initialContext.technicalTerm) return;
    const prompt = `Explique o termo técnico ${initialContext.technicalTerm} em linguagem simples, diga por que ele importa nesta tela e quais sinais devo conferir junto com ele.`;
    void sendMessage(prompt, [welcomeMessage(view, initialContext)]);
  }, [requestKey]);

  if (!enabled) return null;

  function openAssistant() {
    setOpen(true);
    setError("");
  }

  async function sendMessage(value: string, seedMessages = messages) {
    const message = value.trim().slice(0, 600);
    if (!message || busy) return;
    const nextMessages: IrisMessage[] = [
      ...seedMessages,
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
          : "Não foi possível consultar o Agente IA agora.",
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
        <aside className="iris-drawer" aria-label="Agente IA">
          <header className="iris-drawer-header">
            <div className="iris-identity">
              <span className="iris-avatar" aria-hidden="true">
                <Sparkles size={18} />
              </span>
              <div>
                <strong>Agente IA</strong>
                <span>Explicações técnicas com contexto operacional</span>
              </div>
            </div>
            <button
              className="iris-close"
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar Agente IA"
              title="Fechar Agente IA"
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
            <small className="iris-capability-note">
              <BarChart3 size={12} /> Peça indicadores, ranking, tendência ou
              tabela
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
                      {(message.reply.visualizations ?? []).length > 0 && (
                        <div className="iris-visualizations">
                          {(message.reply.visualizations ?? []).map(
                            (visualization) => (
                              <AgentVisualization
                                key={`${visualization.kind}-${visualization.title}`}
                                visualization={visualization}
                              />
                            ),
                          )}
                        </div>
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
            <span>Explore os dados</span>
            {generatedSuggestions.map((suggestion) => (
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
              placeholder="Pergunte ao Agente IA…"
              aria-label="Pergunta para o Agente IA"
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
            O Agente IA mostra evidências e incertezas. Ele não executa mudanças
            nem substitui a decisão do operador.
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
        aria-label={open ? "Fechar Agente IA" : "Abrir Agente IA"}
        title="Explicar com o Agente IA"
      >
        {open ? <X size={20} /> : <Sparkles size={20} />}
        <span>{open ? "Fechar" : "Agente IA"}</span>
      </button>
    </>
  );
}
