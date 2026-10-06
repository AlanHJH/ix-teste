import { useEffect, useMemo, useState } from "react";
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
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "./api";
import { HelpTooltip } from "./HelpTooltip";
import {
  loadAgentPolicy,
  resetAgentPolicy,
  saveAgentPolicy,
} from "./agentPolicy";
import type { AiConfigurationSnapshot } from "./types";

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
    label: "Diagnósticos",
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

export function AgentConfiguration() {
  const [capabilities, setCapabilities] = useState(defaultCapabilities);
  const [resources, setResources] = useState(defaultResources);
  const [feedback, setFeedback] = useState("");
  const [snapshot, setSnapshot] = useState<AiConfigurationSnapshot | null>(
    null,
  );
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

  async function refreshRuntime() {
    setRefreshing(true);
    setRuntimeError("");
    try {
      const current = await api.aiConfiguration();
      setSnapshot(current);
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

  return (
    <section className="agent-settings-page">
      <header className="agent-settings-hero">
        <div>
          <span className="section-label">Governança do agente</span>
          <h1>Configuração do agente IA</h1>
          <p>
            Consulte a configuração efetiva dos agentes e escolha preferências
            locais de contexto. As permissões reais continuam controladas no
            backend e nos servidores MCP.
          </p>
        </div>
        <div
          className="agent-settings-status"
          title="O agente não executa mudanças operacionais."
        >
          <ShieldCheck size={20} />
          <span>
            <strong>Somente leitura</strong>
            <small>
              {snapshot?.runtime.humanApprovalRequired === false
                ? "Revisar política de aprovação"
                : "Aprovação humana obrigatória"}
            </small>
          </span>
        </div>
      </header>

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
            O agente pode consultar evidências e preparar recomendações, mas não
            cria, encerra ou altera chamados, agrupamentos, CPEs ou
            configurações. Toda proposta passa pela validação de uma pessoa.
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
      </div>

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
            A tela Revisão IA registra modelo, ferramentas MCP consultadas,
            argumentos, evidências, resultado, revisor e decisão. O agente não
            recebe ferramentas de escrita; ações operacionais continuam fora do
            fluxo autônomo.
          </p>
        </div>
      </section>
    </section>
  );
}
