import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Check,
  Database,
  History,
  LockKeyhole,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { HelpTooltip } from "./HelpTooltip";
import {
  loadAgentPolicy,
  resetAgentPolicy,
  saveAgentPolicy,
} from "./agentPolicy";

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

export function AgentConfiguration() {
  const [capabilities, setCapabilities] = useState(defaultCapabilities);
  const [resources, setResources] = useState(defaultResources);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    try {
      const policy = loadAgentPolicy();
      setCapabilities(restoreOptions(defaultCapabilities, policy.capabilities));
      setResources(restoreOptions(defaultResources, policy.resources));
    } catch {
      // A configuração padrão continua válida se o armazenamento local estiver indisponível.
    }
  }, []);

  const enabledCapabilities = useMemo(
    () => capabilities.filter((option) => option.checked).length,
    [capabilities],
  );
  const enabledResources = useMemo(
    () => resources.filter((option) => option.checked).length,
    [resources],
  );

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
            Defina o que o agente pode analisar e quais fontes ele pode
            consultar. As permissões efetivas continuam controladas no servidor
            MCP.
          </p>
        </div>
        <div
          className="agent-settings-status"
          title="O agente não executa mudanças operacionais."
        >
          <ShieldCheck size={20} />
          <span>
            <strong>Somente leitura</strong>
            <small>Aprovação humana obrigatória</small>
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
          <strong>{enabledResources}</strong> recursos disponíveis para consulta
        </span>
      </div>

      <div className="agent-settings-grid">
        <section className="panel agent-settings-card">
          <header className="agent-settings-card-heading">
            <div>
              <span className="section-label">Comportamento</span>
              <h2>O que o agente pode fazer</h2>
            </div>
            <Bot size={23} />
          </header>
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
              <span className="section-label">Fontes consultáveis</span>
              <h2>Recursos MCP acessíveis</h2>
            </div>
            <Database size={23} />
          </header>
          <p className="agent-settings-card-note">
            Selecione os domínios que fazem parte do contexto da investigação.
            Todos permanecem em modo somente leitura.
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
            <span className="section-label">Auditoria futura</span>
            <h2>Histórico de ações do agente</h2>
          </div>
          <History size={23} />
        </header>
        <div className="agent-settings-empty">
          <History size={25} />
          <h3>Nenhuma ação operacional registrada</h3>
          <p>
            Este histórico será habilitado quando o agente puder executar ações.
            Por enquanto, ele apenas consulta dados e envia propostas para
            aprovação humana.
          </p>
        </div>
      </section>
    </section>
  );
}
