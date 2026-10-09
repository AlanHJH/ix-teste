import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bot,
  Braces,
  Check,
  Database,
  History,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { api } from "./api";
import { useScreenDataUpdates } from "./realtime";
import { HelpTooltip } from "./HelpTooltip";
import {
  loadAgentPolicy,
  resetAgentPolicy,
  saveAgentPolicy,
} from "./agentPolicy";
import type {
  AiConfigurationSnapshot,
  SupportTicket,
  TicketTriageConfig,
} from "./types";

type ConfigurationOption = {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  locked?: boolean;
  badge?: string;
};

type StoredConfiguration = {
  capabilities: Record<string, boolean>;
  resources: Record<string, boolean>;
};

const defaultCapabilities: ConfigurationOption[] = [
  {
    id: "detect_grouping_candidates",
    label: "Analisar candidatos a agrupamento",
    description:
      "Comparar sinais de telemetria, diagnósticos e chamados para encontrar padrões coletivos.",
    checked: true,
  },
  {
    id: "propose_grouping",
    label: "Propor agrupamento para revisão humana",
    description:
      "Montar evidências, escopo provável e impacto para o NOC validar antes de registrar um agrupamento.",
    checked: true,
  },
  {
    id: "generate_n1_guidance",
    label: "Gerar orientação para o N1",
    description:
      "Explicar o provável problema e a próxima ação recomendada para o atendimento do cliente.",
    checked: true,
  },
  {
    id: "execute_remote_actions",
    label: "Executar ações remotas",
    description:
      "Reiniciar CPEs, alterar configurações ou aplicar correções diretamente no parque.",
    checked: false,
    locked: true,
    badge: "Futuro — indisponível",
  },
];

const defaultResources: ConfigurationOption[] = [
  {
    id: "customers",
    label: "Clientes",
    description:
      "Consultar cliente, vínculo de atendimento e contexto do contrato.",
    checked: true,
    badge: "Somente leitura",
  },
  {
    id: "inventory",
    label: "Inventário",
    description: "Consultar CPEs, OLTs, PONs, CTOs, modelo e firmware.",
    checked: true,
    badge: "Somente leitura",
  },
  {
    id: "telemetry",
    label: "Telemetria",
    description:
      "Consultar medições históricas e sinais recentes dos equipamentos.",
    checked: true,
    badge: "Somente leitura",
  },
  {
    id: "diagnostics",
    label: "Medições",
    description:
      "Consultar testes, erros ópticos, reinícios e outras evidências técnicas.",
    checked: true,
    badge: "Somente leitura",
  },
  {
    id: "tickets",
    label: "Chamados",
    description:
      "Consultar histórico e sinais de chamados relacionados ao problema.",
    checked: true,
    badge: "Somente leitura",
  },
  {
    id: "operations",
    label: "Operação",
    description:
      "Consultar agrupamentos e fila de revisão que aguardam aprovação humana.",
    checked: true,
    badge: "Somente leitura",
  },
  {
    id: "application",
    label: "Aplicação",
    description:
      "Consultar visão geral, topologia, suporte N1, fila do NOC, incidentes e estado das investigações.",
    checked: true,
    badge: "Somente leitura",
  },
];

function optionsToMap(options: ConfigurationOption[]) {
  return Object.fromEntries(
    options.map((option) => [option.id, option.checked]),
  );
}

function restoreOptions(
  defaults: ConfigurationOption[],
  values?: Record<string, boolean>,
) {
  return defaults.map((option) => ({
    ...option,
    checked:
      option.locked || typeof values?.[option.id] !== "boolean"
        ? option.checked
        : values[option.id],
  }));
}

function effectiveResourceOptions(
  domains: AiConfigurationSnapshot["runtime"]["mcpPolicy"]["domains"],
  current: ConfigurationOption[],
) {
  const currentValues = optionsToMap(current);
  return domains.map(({ domain, tools }) => {
    const known = defaultResources.find((resource) => resource.id === domain);
    return {
      id: domain,
      label: known?.label ?? domain,
      description:
        known?.description ??
        `Contexto MCP publicado pelo backend com ${tools.length} ferramentas permitidas.`,
      checked: currentValues[domain] ?? true,
      badge: `${tools.length} ${tools.length === 1 ? "ferramenta" : "ferramentas"}`,
    };
  });
}

function formatCharacters(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function AgentConfiguration() {
  const screenUpdateRevision = useScreenDataUpdates([
    "tickets",
    "investigations",
  ]);
  const [capabilities, setCapabilities] = useState(defaultCapabilities);
  const [resources, setResources] = useState(defaultResources);
  const [feedback, setFeedback] = useState("");
  const [snapshot, setSnapshot] = useState<AiConfigurationSnapshot | null>(
    null,
  );
  const [triageConfig, setTriageConfig] = useState<TicketTriageConfig | null>(
    null,
  );
  const [retryTicketId, setRetryTicketId] = useState("");
  const [retrySuggestions, setRetrySuggestions] = useState<SupportTicket[]>([]);
  const [retrySuggestionsBusy, setRetrySuggestionsBusy] = useState(false);
  const [retrySuggestionsOpen, setRetrySuggestionsOpen] = useState(false);
  const [retryActiveSuggestion, setRetryActiveSuggestion] = useState(0);
  const skipRetrySearchRef = useRef(false);
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryFeedback, setRetryFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [runtimeError, setRuntimeError] = useState("");
  const [refreshing, setRefreshing] = useState(true);

  useEffect(() => {
    try {
      const policy = loadAgentPolicy();
      setCapabilities(restoreOptions(defaultCapabilities, policy.capabilities));
      setResources(restoreOptions(defaultResources, policy.resources));
    } catch {
      // A configuração padrão continua válida se o armazenamento local estiver indisponível.
    }
    void refreshRuntime();
  }, []);

  useEffect(() => {
    if (screenUpdateRevision > 0) void refreshRuntime();
  }, [screenUpdateRevision]);

  useEffect(() => {
    if (skipRetrySearchRef.current) {
      skipRetrySearchRef.current = false;
      return;
    }
    const query = retryTicketId.trim();
    if (query.length < 2) {
      setRetrySuggestions([]);
      setRetrySuggestionsBusy(false);
      setRetrySuggestionsOpen(false);
      setRetryActiveSuggestion(0);
      return;
    }

    let cancelled = false;
    setRetrySuggestionsBusy(true);
    const timeoutId = window.setTimeout(() => {
      void api
        .tickets(query, 1)
        .then((result) => {
          if (cancelled) return;
          setRetrySuggestions(result.data.slice(0, 8));
          setRetrySuggestionsOpen(true);
          setRetryActiveSuggestion(0);
        })
        .catch(() => {
          if (cancelled) return;
          setRetrySuggestions([]);
          setRetrySuggestionsOpen(true);
          setRetryActiveSuggestion(0);
        })
        .finally(() => {
          if (!cancelled) setRetrySuggestionsBusy(false);
        });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [retryTicketId]);

  async function refreshRuntime() {
    setRefreshing(true);
    setRuntimeError("");
    try {
      const [current, currentTriage] = await Promise.all([
        api.aiConfiguration(),
        api.ticketTriageConfig(),
      ]);
      setSnapshot(current);
      setTriageConfig(currentTriage);
      setResources((resourcesValue) =>
        effectiveResourceOptions(
          current.runtime.mcpPolicy.domains,
          resourcesValue,
        ),
      );
    } catch (error) {
      setRuntimeError(
        error instanceof Error
          ? error.message
          : "Não foi possível consultar a configuração efetiva.",
      );
    } finally {
      setRefreshing(false);
    }
  }

  const enabledCapabilities = useMemo(
    () => capabilities.filter((option) => option.checked).length,
    [capabilities],
  );
  const enabledResources = useMemo(
    () => resources.filter((option) => option.checked).length,
    [resources],
  );

  const publishedMcpEndpoints = snapshot?.catalog.mcp.endpoints ?? [];

  function toggle(
    group: "capabilities" | "resources",
    id: string,
    checked: boolean,
  ) {
    const setter = group === "capabilities" ? setCapabilities : setResources;
    setter((current) =>
      current.map((option) =>
        option.id === id && !option.locked ? { ...option, checked } : option,
      ),
    );
    setFeedback("");
  }

  function save() {
    const configuration: StoredConfiguration = {
      capabilities: optionsToMap(capabilities),
      resources: optionsToMap(resources),
    };
    try {
      saveAgentPolicy(configuration);
      setFeedback("Preferências salvas neste navegador.");
    } catch {
      setFeedback("Não foi possível salvar neste navegador.");
    }
  }

  function reset() {
    setCapabilities(defaultCapabilities);
    setResources(defaultResources);
    try {
      resetAgentPolicy();
      setFeedback("Configuração padrão restaurada.");
    } catch {
      setFeedback("Configuração padrão restaurada nesta sessão.");
    }
  }

  function selectRetryTicket(ticket: SupportTicket) {
    if (ticket.ticket_id !== retryTicketId.trim()) {
      skipRetrySearchRef.current = true;
    }
    setRetryTicketId(ticket.ticket_id);
    setRetrySuggestions([]);
    setRetrySuggestionsOpen(false);
    setRetryActiveSuggestion(0);
    setRetryFeedback(null);
  }

  async function requestTicketRetry() {
    const ticketId = retryTicketId.trim().toUpperCase();
    if (!ticketId) {
      setRetryFeedback({
        tone: "error",
        message: "Informe o identificador do ticket.",
      });
      return;
    }
    setRetryBusy(true);
    setRetryFeedback(null);
    try {
      const result = await api.retryTicketTriage(ticketId);
      if (result.skipped) {
        setRetryFeedback({
          tone: "error",
          message: result.reason ?? "A triagem não foi iniciada.",
        });
      } else {
        const status =
          result.status === "completed"
            ? "concluída"
            : result.status === "needs_review"
              ? "concluída e enviada para revisão humana"
              : "encerrada com falha";
        setRetryFeedback({
          tone: result.status === "failed" ? "error" : "success",
          message: `Ticket ${ticketId}: nova análise ${status}. Histórico anterior preservado.`,
        });
      }
    } catch (error) {
      setRetryFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível solicitar a nova análise.",
      });
    } finally {
      setRetryBusy(false);
    }
  }

  return (
    <section className="agent-settings-page">
      <section
        className="agent-settings-policy"
        aria-label="Política de segurança atual"
      >
        <div className="agent-settings-policy-icon">
          <LockKeyhole size={18} />
        </div>
        <div>
          <strong>Proteções ativas hoje</strong>
          <p>
            {snapshot?.runtime.autoGroupingEnabled
              ? `O modelo continua sem ferramentas de escrita. O backend pode ativar automaticamente apenas propostas do detector de métricas com confiança igual ou superior a ${formatConfidence(snapshot.runtime.autoGroupingMinConfidence)}; os demais achados continuam aguardando uma pessoa.`
              : "O agente pode consultar evidências e preparar recomendações, mas não cria, encerra ou altera chamados, agrupamentos, CPEs ou configurações. Toda proposta passa pela validação de uma pessoa."}
          </p>
        </div>
        <HelpTooltip
          term="MCP"
          description="Protocolo que conecta o agente a ferramentas da aplicação com permissões controladas. Neste ambiente, as ferramentas são somente leitura."
        />
      </section>

      <div className="agent-settings-summary" aria-live="polite">
        <span>
          <Sparkles size={15} />
          <strong>{enabledCapabilities}</strong> capacidades habilitadas
        </span>
        <span>
          <Database size={15} />
          <strong>{enabledResources}</strong> preferências locais de fonte
        </span>
        <span>
          <Activity size={15} />
          <strong>{snapshot?.runtime.mcpPolicy.toolCount ?? "—"}</strong>{" "}
          ferramentas MCP efetivas
        </span>
        <span>
          <Braces size={15} />
          <strong>{snapshot?.dashboardResourceCount ?? "—"}</strong> recursos do
          dashboard
        </span>
      </div>

      <div className="agent-settings-runtime-grid">
        <section className="panel agent-settings-runtime-card">
          <header className="agent-settings-card-heading">
            <div>
              <span className="section-label">Estado efetivo</span>
              <h2>Agente de investigação</h2>
            </div>
            <button
              className="agent-settings-refresh"
              type="button"
              onClick={() => void refreshRuntime()}
              disabled={refreshing}
              aria-label="Atualizar configuração efetiva"
              title="Atualizar configuração efetiva"
            >
              <RefreshCw size={16} />
            </button>
          </header>
          {runtimeError ? (
            <div className="agent-settings-runtime-error" role="alert">
              <strong>Configuração indisponível</strong>
              <span>{runtimeError}</span>
            </div>
          ) : refreshing && !snapshot ? (
            <div className="agent-settings-runtime-loading">
              <RefreshCw size={17} /> Consultando o backend…
            </div>
          ) : snapshot ? (
            <>
              <div className="agent-settings-runtime-status">
                <span
                  className={
                    snapshot.runtime.openaiConfigured ? "ready" : "warning"
                  }
                >
                  {snapshot.runtime.openaiConfigured
                    ? "OpenAI configurada"
                    : "OpenAI não configurada"}
                </span>
                <code>{snapshot.runtime.model}</code>
              </div>
              <dl className="agent-settings-runtime-facts">
                <div>
                  <dt>Allowlist MCP</dt>
                  <dd>
                    {snapshot.runtime.mcpPolicy.endpointCount} contextos ·{" "}
                    {snapshot.runtime.mcpPolicy.toolCount} ferramentas
                  </dd>
                </div>
                <div>
                  <dt>Concorrência</dt>
                  <dd>
                    {snapshot.runtime.maxConcurrency} investigação por vez
                  </dd>
                </div>
                <div>
                  <dt>Contexto máximo</dt>
                  <dd>
                    {formatCharacters(snapshot.runtime.maxContextCharacters)}{" "}
                    caracteres
                  </dd>
                </div>
                <div>
                  <dt>Orçamento de ferramentas</dt>
                  <dd>
                    {snapshot.runtime.toolCallBudgets.metric} métrica ·{" "}
                    {snapshot.runtime.toolCallBudgets.schedule} agenda ·{" "}
                    {snapshot.runtime.toolCallBudgets.manual} manual
                  </dd>
                </div>
                <div>
                  <dt>Tempo máximo OpenAI</dt>
                  <dd>
                    {Math.round(snapshot.runtime.openaiTimeoutMs / 1000)}s por
                    chamada
                  </dd>
                </div>
              </dl>
              <div className="agent-settings-runtime-flags">
                <span>
                  Detector por métricas:{" "}
                  <strong>
                    {snapshot.runtime.metricTriggerEnabled
                      ? "ativo"
                      : "inativo"}
                  </strong>
                </span>
                <span>
                  Agenda automática:{" "}
                  <strong>
                    {snapshot.runtime.scheduleEnabled ? "ativa" : "inativa"}
                  </strong>
                </span>
                <span>
                  Autoagrupamento:{" "}
                  <strong>
                    {snapshot.runtime.autoGroupingEnabled
                      ? `ativo ≥ ${formatConfidence(snapshot.runtime.autoGroupingMinConfidence)}`
                      : "inativo"}
                  </strong>
                </span>
                <span>
                  Ferramentas de escrita:{" "}
                  <strong>
                    {snapshot.runtime.writeToolsAvailableToAgent
                      ? "disponíveis"
                      : "bloqueadas"}
                  </strong>
                </span>
              </div>
            </>
          ) : null}
        </section>

        <section className="panel agent-settings-runtime-card">
          <header className="agent-settings-card-heading">
            <div>
              <span className="section-label">Descoberta de contratos</span>
              <h2>Compositor do dashboard</h2>
            </div>
            <Braces size={23} />
          </header>
          <p className="agent-settings-card-note">
            O compositor descobre estruturas pelo bridge MCP/OpenAPI. Os dados
            operacionais continuam sendo carregados diretamente por REST no
            navegador e não são enviados ao modelo.
          </p>
          <div className="agent-settings-contract-metrics">
            <div>
              <strong>{snapshot?.catalog.rest.operationCount ?? "—"}</strong>
              <span>operações REST</span>
            </div>
            <div>
              <strong>{snapshot?.dashboardResourceCount ?? "—"}</strong>
              <span>recursos de leitura</span>
            </div>
            <div>
              <strong>{publishedMcpEndpoints.length || "—"}</strong>
              <span>endpoints MCP</span>
            </div>
          </div>
          <div className="agent-settings-contract-paths">
            <span>
              <small>Bridge MCP</small>
              <code>/mcp/openapi</code>
            </span>
            <span>
              <small>Contrato canônico</small>
              <a href="/api/openapi.json" target="_blank" rel="noreferrer">
                /api/openapi.json
              </a>
            </span>
            <span>
              <small>Documentação humana</small>
              <a href="/api/docs" target="_blank" rel="noreferrer">
                /api/docs
              </a>
            </span>
          </div>
          <div className="agent-settings-endpoints" aria-label="Endpoints MCP">
            {publishedMcpEndpoints.map((endpoint) => (
              <span key={endpoint.path} title={endpoint.description}>
                {endpoint.domain}
              </span>
            ))}
          </div>
        </section>

        <section className="panel agent-settings-runtime-card">
          <header className="agent-settings-card-heading">
            <div>
              <span className="section-label">Atendimento N1</span>
              <h2>Triagem recorrente de tickets</h2>
            </div>
            <History size={23} />
          </header>
          {triageConfig ? (
            <>
              <div className="agent-settings-runtime-status">
                <span
                  className={
                    triageConfig.openaiConfigured &&
                    triageConfig.scheduleEnabled
                      ? "ready"
                      : "warning"
                  }
                >
                  {triageConfig.scheduleEnabled
                    ? triageConfig.openaiConfigured
                      ? "Triagem ativa"
                      : "Aguardando chave OpenAI"
                    : "Triagem pausada"}
                </span>
                <code>{triageConfig.model}</code>
              </div>
              <dl className="agent-settings-runtime-facts">
                <div>
                  <dt>Frequência</dt>
                  <dd>{Math.round(triageConfig.intervalMs / 60_000)} min</dd>
                </div>
                <div>
                  <dt>Lote por ciclo</dt>
                  <dd>{triageConfig.batchSize} tickets</dd>
                </div>
                <div>
                  <dt>Análises simultâneas</dt>
                  <dd>{triageConfig.concurrency}</dd>
                </div>
                <div>
                  <dt>Confiança mínima</dt>
                  <dd>{formatConfidence(triageConfig.minConfidence)}</dd>
                </div>
                <div>
                  <dt>Encerramento automático</dt>
                  <dd>{triageConfig.autoClose ? "Ativo" : "Bloqueado"}</dd>
                </div>
              </dl>
              <div className="agent-settings-runtime-flags">
                <span>
                  Ações automáticas: {triageConfig.automaticActions.join(" · ")}
                </span>
                <span>
                  Encaminhamento automático ao NOC:{" "}
                  {triageConfig.autoEscalateNoc ? "ativo" : "desligado"}
                </span>
                <span>
                  Revisão humana: {triageConfig.humanReviewActions.join(" · ")}
                </span>
              </div>
            </>
          ) : (
            <div className="agent-settings-runtime-loading">
              <RefreshCw size={17} /> Consultando a triagem de tickets…
            </div>
          )}
        </section>
      </div>

      <section
        className="panel agent-settings-retry-card"
        aria-labelledby="agent-settings-retry-title"
      >
        <header className="agent-settings-card-heading">
          <div>
            <span className="section-label">Revisão assistida</span>
            <h2 id="agent-settings-retry-title">Reavaliar um ticket pela IA</h2>
          </div>
          <History size={23} />
        </header>
        <p className="agent-settings-card-note">
          Busque um ticket já analisado ou encaminhado pela IA. Uma nova
          execução usa os dados técnicos atuais, não apaga as análises
          anteriores e registra uma nova decisão no histórico de auditoria.
        </p>
        <form
          className="agent-settings-retry-form"
          onSubmit={(event) => {
            event.preventDefault();
            void requestTicketRetry();
          }}
        >
          <label htmlFor="agent-settings-retry-ticket">Buscar ticket</label>
          <div className="agent-settings-retry-controls">
            <div className="agent-settings-retry-input-wrap">
              <input
                id="agent-settings-retry-ticket"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="agent-settings-retry-suggestions"
                aria-expanded={retrySuggestionsOpen}
                aria-activedescendant={
                  retrySuggestionsOpen && retrySuggestions.length > 0
                    ? `agent-settings-retry-option-${retrySuggestions[retryActiveSuggestion]?.ticket_id}`
                    : undefined
                }
                value={retryTicketId}
                onChange={(event) => {
                  setRetryTicketId(event.target.value);
                  setRetryFeedback(null);
                  setRetrySuggestionsOpen(true);
                }}
                onFocus={() => {
                  if (retryTicketId.trim().length >= 2) {
                    setRetrySuggestionsOpen(true);
                  }
                }}
                onBlur={() => setRetrySuggestionsOpen(false)}
                onKeyDown={(event) => {
                  if (
                    event.key === "ArrowDown" &&
                    retrySuggestions.length > 0
                  ) {
                    event.preventDefault();
                    setRetrySuggestionsOpen(true);
                    setRetryActiveSuggestion((current) =>
                      Math.min(current + 1, retrySuggestions.length - 1),
                    );
                  } else if (
                    event.key === "ArrowUp" &&
                    retrySuggestions.length > 0
                  ) {
                    event.preventDefault();
                    setRetryActiveSuggestion((current) =>
                      Math.max(current - 1, 0),
                    );
                  } else if (
                    event.key === "Enter" &&
                    retrySuggestionsOpen &&
                    retrySuggestions[retryActiveSuggestion]
                  ) {
                    event.preventDefault();
                    selectRetryTicket(retrySuggestions[retryActiveSuggestion]);
                  } else if (event.key === "Escape") {
                    setRetrySuggestionsOpen(false);
                  }
                }}
                placeholder="Digite ID, cliente ou parte do relato"
                maxLength={120}
                disabled={retryBusy}
              />
              {retrySuggestionsOpen && retryTicketId.trim().length >= 2 && (
                <div
                  id="agent-settings-retry-suggestions"
                  className="agent-settings-retry-suggestions"
                  role="listbox"
                  aria-label="Tickets encontrados"
                >
                  {retrySuggestionsBusy ? (
                    <div className="agent-settings-retry-suggestion-state">
                      Buscando tickets…
                    </div>
                  ) : retrySuggestions.length > 0 ? (
                    retrySuggestions.map((ticket, index) => (
                      <button
                        key={ticket.ticket_id}
                        id={`agent-settings-retry-option-${ticket.ticket_id}`}
                        type="button"
                        role="option"
                        aria-selected={index === retryActiveSuggestion}
                        className={`agent-settings-retry-suggestion ${index === retryActiveSuggestion ? "active" : ""}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectRetryTicket(ticket)}
                      >
                        <strong>{ticket.ticket_id}</strong>
                        <span>
                          Cliente {ticket.customer_id} · {ticket.category} ·{" "}
                          {ticket.channel}
                        </span>
                        <small>
                          {ticket.description || "Sem relato registrado"} ·{" "}
                          {ticket.city ?? "Localidade não informada"}
                        </small>
                      </button>
                    ))
                  ) : (
                    <div className="agent-settings-retry-suggestion-state">
                      Nenhum ticket encontrado.
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              className="agent-settings-retry-submit"
              type="submit"
              disabled={retryBusy}
            >
              <RefreshCw size={15} />
              {retryBusy ? "Reavaliando…" : "Solicitar nova análise"}
            </button>
          </div>
        </form>
        <p className="agent-settings-retry-hint">
          Pesquise pelo ID, cliente ou parte do relato e selecione o chamado
          correto. A reavaliação também pode ser usada em tickets históricos; a
          triagem automática recorrente continua priorizando tickets novos do
          N1.
        </p>
        {retryFeedback && (
          <div
            className={`agent-settings-retry-feedback ${retryFeedback.tone}`}
            role={retryFeedback.tone === "error" ? "alert" : "status"}
          >
            {retryFeedback.message}
          </div>
        )}
      </section>

      <div className="agent-settings-grid">
        <section className="panel agent-settings-card">
          <header className="agent-settings-card-heading">
            <div>
              <span className="section-label">Preferência local</span>
              <h2>Foco da investigação</h2>
            </div>
            <Bot size={23} />
          </header>
          <p className="agent-settings-card-note">
            Essas escolhas preparam o contexto preferido neste navegador. Elas
            não alteram a allowlist nem habilitam capacidades no servidor.
          </p>
          <div className="agent-settings-options">
            {capabilities.map((option) => (
              <label
                className={`agent-settings-option ${option.locked ? "locked" : ""}`}
                key={option.id}
              >
                <input
                  type="checkbox"
                  checked={option.checked}
                  disabled={option.locked}
                  onChange={(event) =>
                    toggle("capabilities", option.id, event.target.checked)
                  }
                  aria-describedby={`${option.id}-description`}
                />
                <span className="agent-settings-checkbox" aria-hidden="true">
                  {option.checked && <Check size={13} />}
                </span>
                <span className="agent-settings-option-copy">
                  <span className="agent-settings-option-title">
                    {option.label}
                    {option.badge && (
                      <small className="agent-settings-badge">
                        {option.badge}
                      </small>
                    )}
                  </span>
                  <span
                    id={`${option.id}-description`}
                    className="agent-settings-option-description"
                  >
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="panel agent-settings-card">
          <header className="agent-settings-card-heading">
            <div>
              <span className="section-label">Preferência local</span>
              <h2>Fontes priorizadas</h2>
            </div>
            <Database size={23} />
          </header>
          <p className="agent-settings-card-note">
            A lista vem da allowlist efetiva do backend. Desmarcar uma fonte só
            registra uma preferência local; todas permanecem tecnicamente em
            modo somente leitura.
          </p>
          <div className="agent-settings-options">
            {resources.map((option) => (
              <label className="agent-settings-option" key={option.id}>
                <input
                  type="checkbox"
                  checked={option.checked}
                  onChange={(event) =>
                    toggle("resources", option.id, event.target.checked)
                  }
                  aria-describedby={`${option.id}-resource-description`}
                />
                <span className="agent-settings-checkbox" aria-hidden="true">
                  {option.checked && <Check size={13} />}
                </span>
                <span className="agent-settings-option-copy">
                  <span className="agent-settings-option-title">
                    {option.label}
                    {option.badge && (
                      <small className="agent-settings-badge">
                        {option.badge}
                      </small>
                    )}
                  </span>
                  <span
                    id={`${option.id}-resource-description`}
                    className="agent-settings-option-description"
                  >
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="agent-settings-actions">
        <p>
          No protótipo, estas preferências ficam salvas neste navegador para
          preparar a política. Elas não ampliam as permissões do servidor MCP.
        </p>
        <div>
          <button
            className="agent-settings-reset"
            type="button"
            onClick={reset}
          >
            <RotateCcw size={15} /> Restaurar padrão
          </button>
          <button className="agent-settings-save" type="button" onClick={save}>
            <Save size={15} /> Salvar preferências
          </button>
        </div>
        {feedback && (
          <span className="agent-settings-feedback">
            <Check size={14} /> {feedback}
          </span>
        )}
      </div>

      <section className="panel agent-settings-history">
        <header className="agent-settings-card-heading">
          <div>
            <span className="section-label">Auditoria</span>
            <h2>Rastreabilidade das investigações</h2>
          </div>
          <History size={23} />
        </header>
        <div className="agent-settings-empty">
          <History size={25} />
          <h3>Consultas e decisões permanecem auditáveis</h3>
          <p>
            A fila de aprovação do NOC registra modelo, ferramentas MCP
            consultadas, argumentos, evidências, resultado, revisor e decisão.
            {snapshot?.runtime.autoGroupingEnabled
              ? " O agente não recebe ferramentas de escrita; o backend registra e limita o autoagrupamento pelo limiar configurado."
              : " O agente não recebe ferramentas de escrita; ações operacionais continuam fora do fluxo autônomo."}
          </p>
        </div>
      </section>
    </section>
  );
}
