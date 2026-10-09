import { FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  Network,
  Plus,
  TicketCheck,
  X,
} from "lucide-react";
import { api } from "./api";
import { HelpTooltip } from "./HelpTooltip";
import { InvestigationReview } from "./InvestigationReview";
import { OpenIrisChatButton } from "./OpenIrisChatButton";
import { PhysicalTopology } from "./PhysicalTopology";
import { topologyFocusFromIncident } from "./topologyFocus";
import { SideDrawer } from "./SideDrawer";
import { groupingAgentEnabled, useAgentPolicy } from "./agentPolicy";
import { providerGlossary, TechnicalText } from "./ProviderGlossary";
import type {
  IncidentOptionType,
  Investigation,
  IrisContext,
  OperationalIncident,
  OperationalIncidentPage,
  TopologyFocus,
} from "./types";

type IncidentOption = { value: string; label: string };

const emptyCatalogOptions = (): Record<
  IncidentOptionType,
  IncidentOption[]
> => ({
  olt: [],
  pon: [],
  cto: [],
  customer: [],
  firmware: [],
  equipment: [],
  region: [],
});

type ScopeType =
  | "park"
  | "olt"
  | "pon"
  | "cto"
  | "customer"
  | "firmware"
  | "equipment"
  | "region";

const initialForm = {
  openedBy: "",
  title: "",
  severity: "high" as "critical" | "high" | "medium" | "low",
  scopeType: "pon" as ScopeType,
  identifier: "",
  olt: "",
  pon: "",
  cto: "",
  probableCause: "",
  recommendedAction: "",
  originTicketId: null as string | null,
};

const scopeLabels: Record<ScopeType, string> = {
  park: "Parque inteiro",
  olt: "OLT",
  pon: "Porta PON",
  cto: "CTO",
  customer: "Cliente ou CPE",
  firmware: "Versão de firmware",
  equipment: "Modelo de equipamento",
  region: "Cidade ou bairro",
};

const severityLabels = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

type GroupingCardData = {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  location: string;
  affected: number;
  confidence: string;
  signal: string;
  recommendation: string;
  owner: string;
  evidence: Array<{ source: string; summary: string; reference: string }>;
  origin: string;
  originTicketId: string | null;
};

const evidenceSourceLabel: Record<string, string> = {
  operations: "Detecção inicial",
  inventory: "Inventário da rede",
  telemetry: "Medições dos equipamentos",
  diagnostics: "Medições técnicas",
  tickets: "Chamados de clientes",
  customers: "Contexto do cliente",
};

const evidenceReferenceLabel: Record<string, string> = {
  operations_list_grouping_candidates: "Consulta do detector de agrupamentos",
  inventory_topology: "Consulta de inventário e topologia",
  telemetry_list_daily_metrics: "Consulta das medições dos equipamentos",
  diagnostics_list: "Consulta das medições técnicas",
  tickets_list: "Consulta dos chamados de clientes",
  customers_list: "Consulta do contexto do cliente",
};

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function humanizeEvidence(value: string) {
  return value
    .replace(
      /^Candidato (?:pré-calculado|reporta|registra|indica):?\s*/i,
      "O detector identificou ",
    )
    .replace(
      /^Nenhum chamado correspondente retornado/i,
      "Não foram encontrados chamados relacionados",
    )
    .replace(
      /^A consulta retornou zero registros/i,
      "Não foram encontrados registros no período consultado",
    )
    .replace(
      /; ausência de resultado não confirma nem refuta a ([^.]+)\./i,
      ". Isso não confirma nem descarta a $1.",
    );
}

function humanizeEvidenceReference(value: string) {
  if (!value) return "";
  const tool = value.split(" — ", 1)[0];
  return evidenceReferenceLabel[tool] ?? "Consulta registrada pelo sistema";
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

function operationalGrouping(incident: OperationalIncident): GroupingCardData {
  const evidence = incident.evidence
    .map((record) => {
      const source = textValue(record.source) || "operations";
      const summary =
        textValue(record.summary) ||
        Object.entries(record)
          .filter(
            ([key, value]) =>
              key !== "source" &&
              key !== "reference" &&
              typeof value === "string",
          )
          .map(([, value]) => textValue(value))
          .filter(Boolean)
          .join(" ");
      return {
        source,
        summary: humanizeEvidence(summary),
        reference: humanizeEvidenceReference(textValue(record.reference)),
      };
    })
    .filter((item) => item.summary);

  return {
    id: incident.incident_id,
    severity: incident.severity,
    title: incident.title,
    location: incident.scope.identifier,
    affected: incident.affected_cpes,
    confidence: `${Math.round(incident.confidence * 100)}%`,
    signal: incident.probable_cause,
    recommendation: incident.recommended_action,
    owner: incident.opened_by,
    evidence,
    origin:
      incident.source === "manual" ? "Registro do NOC" : "Detecção automática",
    originTicketId: incident.origin_ticket_id,
  };
}

function GroupingScopePath({ location }: { location: string }) {
  const segments = location
    .split(" · ")
    .map((segment) => segment.trim())
    .filter(Boolean);

  return (
    <span className="grouping-scope-path" aria-label={location}>
      {segments.map((segment, index) => (
        <span
          className="grouping-scope-segment-wrap"
          key={`${segment}-${index}`}
        >
          {index > 0 && (
            <span className="grouping-scope-separator" aria-hidden="true">
              ·
            </span>
          )}
          <span className="grouping-scope-segment">{segment}</span>
        </span>
      ))}
    </span>
  );
}

const investigationStatusLabel: Record<Investigation["status"], string> = {
  queued: "Análise na fila",
  running: "IA analisando o problema",
  no_problem: "Nenhum problema confirmado",
  inconclusive: "Análise inconclusiva",
  pending_review: "Aguardando revisão humana",
  approved: "Análise aprovada anteriormente",
  rejected: "Análise descartada",
  failed: "Falha na análise",
};

function confidencePercent(value: number) {
  return Math.round(value <= 1 ? value * 100 : value);
}

function topologyFocusFromInvestigation(
  investigation: Investigation,
): TopologyFocus | null {
  const finding = investigation.finding;
  if (!finding) return null;

  return {
    id: investigation.incident_id ?? investigation.investigation_id,
    kind: "grouping",
    title: finding.title,
    severity: finding.severity,
    confidence: finding.confidence,
    scope: finding.scope,
    affectedCpes: finding.affectedCpes,
  };
}

function InfrastructureAiAnalysis({
  analysis,
  loading,
  error,
}: {
  analysis: Investigation | null;
  loading: boolean;
  error: string;
}) {
  const finding = analysis?.finding;
  return (
    <section className="grouping-ai-analysis" aria-live="polite">
      <header>
        <div>
          <span className="section-label">Investigação sob demanda</span>
          <h3>
            <Bot size={17} /> Possibilidades de solução analisadas pela IA
          </h3>
          <p>
            Ao abrir este problema, a IA consulta as fontes operacionais
            disponíveis e compara hipóteses de confirmação, mitigação e
            correção.
          </p>
        </div>
        {analysis && (
          <span className={`grouping-ai-status ${analysis.status}`}>
            {investigationStatusLabel[analysis.status]}
          </span>
        )}
      </header>

      {loading && !finding && (
        <div className="grouping-ai-loading" role="status">
          <LoaderCircle size={17} className="spin" />
          <span>
            A análise está consultando telemetria, inventário, diagnósticos e
            chamados…
          </span>
        </div>
      )}

      {error && (
        <div className="grouping-ai-error" role="alert">
          <CircleAlert size={16} /> {error}
        </div>
      )}

      {analysis?.error && (
        <div className="grouping-ai-error" role="alert">
          <CircleAlert size={16} /> {analysis.error}
        </div>
      )}

      {finding && (
        <>
          <div className="grouping-ai-conclusion">
            <div>
              <span>Hipótese principal</span>
              <strong>
                <TechnicalText text={finding.title} />
              </strong>
              <p>{finding.summary}</p>
            </div>
            <div>
              <span>Confiança</span>
              <strong>{confidencePercent(finding.confidence)}%</strong>
              <small>{investigationStatusLabel[analysis.status]}</small>
            </div>
          </div>

          <div className="grouping-ai-solution-grid">
            <section>
              <span>Causa provável</span>
              <p>{finding.probableCause}</p>
            </section>
            <section>
              <span>Possibilidades de solução</span>
              <ul>
                {recommendedActionSteps(finding.recommendedAction).map(
                  (action) => (
                    <li key={`${action.label}-${action.text}`}>
                      <CheckCircle2 size={14} />
                      <div>
                        <strong>{action.label}</strong>
                        <p>{action.text}</p>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            </section>
          </div>

          <div className="grouping-ai-evidence-grid">
            <section>
              <span>Evidências usadas</span>
              <ul>
                {finding.evidence.map((item) => (
                  <li key={`${item.source}-${item.reference}`}>
                    <strong>
                      {evidenceSourceLabel[item.source] ?? item.source}
                    </strong>
                    <p>{item.summary}</p>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <span>Evidências contrárias</span>
              {finding.counterEvidence.length > 0 ? (
                <ul>
                  {finding.counterEvidence.map((item) => (
                    <li key={`${item.source}-${item.reference}`}>
                      <strong>
                        {evidenceSourceLabel[item.source] ?? item.source}
                      </strong>
                      <p>{item.summary}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="grouping-ai-none">Nenhuma registrada.</p>
              )}
            </section>
          </div>
          <p className="grouping-ai-note">
            A recomendação é somente leitura e exige revisão humana. A IA não
            executa rollback, alteração de porta, visita ou comunicação por
            conta própria.
          </p>
        </>
      )}
    </section>
  );
}

function GroupingCard({
  grouping,
  onOpen,
}: {
  grouping: GroupingCardData;
  onOpen: () => void;
}) {
  return (
    <article className={`active-grouping-card ${grouping.severity}`}>
      <button
        type="button"
        className="active-grouping-card-open"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-label={`Abrir detalhes do agrupamento: ${grouping.title}`}
      >
        <header>
          <div className="investigation-tags">
            <span>Agrupamento ativo</span>
            <span className={`active-grouping-severity ${grouping.severity}`}>
              {severityLabels[grouping.severity]}
            </span>
          </div>
          <div className="investigation-confidence compact">
            <strong>{grouping.confidence}</strong>
            <span>confiança</span>
          </div>
        </header>
        <div className="investigation-card-copy">
          <h3>{grouping.title}</h3>
          <small>{grouping.id}</small>
        </div>
        <div className="investigation-card-preview">
          <div>
            <span>Alcance</span>
            <strong>
              <GroupingScopePath location={grouping.location} />
            </strong>
          </div>
          <div>
            <span>Impacto estimado</span>
            <strong>{grouping.affected.toLocaleString("pt-BR")} CPEs</strong>
          </div>
          <p>{grouping.signal}</p>
        </div>
        <footer>
          <span>Ver detalhes do agrupamento</span>
          <ChevronRight size={16} aria-hidden="true" />
        </footer>
      </button>
    </article>
  );
}

export function NocOperations({
  nocTicketCount,
  onOpenNocTickets,
  onOpenAssistant,
}: {
  nocTicketCount: number;
  onOpenNocTickets: () => void;
  onOpenAssistant?: (context: IrisContext) => void;
}) {
  const agentPolicy = useAgentPolicy();
  const showGroupingAgent = groupingAgentEnabled(agentPolicy);
  const [incidents, setIncidents] = useState<OperationalIncidentPage | null>(
    null,
  );
  const [catalogOptions, setCatalogOptions] = useState(emptyCatalogOptions);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState("");
  const [closedGrouping, setClosedGrouping] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [closingGrouping, setClosingGrouping] = useState("");
  const [selectedGroupingId, setSelectedGroupingId] = useState("");
  const [topologyGrouping, setTopologyGrouping] =
    useState<TopologyFocus | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] =
    useState<Investigation | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  async function refresh() {
    try {
      const nextIncidents = await api.operationalIncidents();
      setIncidents(nextIncidents);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Falha ao consultar o NOC",
      );
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  function openCreateGrouping() {
    setCreated("");
    setError("");
    setForm((current) => ({ ...initialForm, openedBy: current.openedBy }));
    setModalOpen(true);
  }

  useEffect(() => {
    if (!modalOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) setModalOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, modalOpen]);

  useEffect(() => {
    if (!selectedGroupingId) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !closingGrouping) {
        setSelectedGroupingId("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closingGrouping, selectedGroupingId]);

  useEffect(() => {
    if (!selectedGroupingId || !showGroupingAgent) {
      setSelectedAnalysis(null);
      setAnalysisLoading(false);
      setAnalysisError("");
      return;
    }

    let cancelled = false;
    setSelectedAnalysis(null);
    setAnalysisLoading(true);
    setAnalysisError("");

    async function analyzeSelectedProblem() {
      try {
        let next = await api.triggerIncidentInvestigation(selectedGroupingId);
        if (cancelled) return;
        setSelectedAnalysis(next);

        for (
          let attempt = 0;
          attempt < 20 && ["queued", "running"].includes(next.status);
          attempt += 1
        ) {
          await new Promise((resolve) => window.setTimeout(resolve, 1_500));
          if (cancelled) return;
          next = await api.investigation(next.investigation_id);
          if (cancelled) return;
          setSelectedAnalysis(next);
        }
      } catch (reason) {
        if (!cancelled) {
          setAnalysisError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível iniciar a análise deste problema.",
          );
        }
      } finally {
        if (!cancelled) setAnalysisLoading(false);
      }
    }

    void analyzeSelectedProblem();
    return () => {
      cancelled = true;
    };
  }, [selectedGroupingId, showGroupingAgent]);

  useEffect(() => {
    if (!modalOpen) return;
    const scope = form.scopeType;
    const lookups: Array<{
      type: IncidentOptionType;
      query: string;
      olt?: string;
      pon?: string;
    }> = [];

    if (["olt", "pon", "cto"].includes(scope)) {
      lookups.push({ type: "olt", query: form.olt });
    }
    if (["pon", "cto"].includes(scope) && form.olt) {
      lookups.push({ type: "pon", query: form.pon, olt: form.olt });
    }
    if (scope === "cto" && form.olt && form.pon) {
      lookups.push({
        type: "cto",
        query: form.cto,
        olt: form.olt,
        pon: form.pon,
      });
    }
    if (["customer", "firmware", "equipment", "region"].includes(scope)) {
      lookups.push({
        type: scope as IncidentOptionType,
        query: form.identifier,
      });
    }

    if (lookups.length === 0) {
      setCatalogLoading(false);
      setCatalogError("");
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setCatalogLoading(true);
      void Promise.all(lookups.map((lookup) => api.incidentOptions(lookup)))
        .then((responses) => {
          if (cancelled) return;
          setCatalogOptions((current) => {
            const next = { ...current };
            for (const response of responses) {
              next[response.meta.type] = response.data;
            }
            return next;
          });
          setCatalogError("");
        })
        .catch((reason) => {
          if (cancelled) return;
          setCatalogError(
            reason instanceof Error
              ? reason.message
              : "Falha ao consultar opções cadastradas.",
          );
        })
        .finally(() => {
          if (!cancelled) setCatalogLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    form.cto,
    form.identifier,
    form.olt,
    form.pon,
    form.scopeType,
    modalOpen,
  ]);

  function update<Key extends keyof typeof form>(
    key: Key,
    value: (typeof form)[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateScope(scopeType: ScopeType) {
    setCatalogError("");
    setForm((current) => ({
      ...current,
      scopeType,
      identifier: "",
      olt: "",
      pon: "",
      cto: "",
    }));
  }

  function updateOlt(olt: string) {
    setForm((current) => ({
      ...current,
      olt: olt.toUpperCase(),
      pon: "",
      cto: "",
    }));
  }

  function updatePon(pon: string) {
    setForm((current) => ({ ...current, pon, cto: "" }));
  }

  function confirmGroupingClosure(title: string) {
    return window.confirm(
      `Encerrar o agrupamento “${title}”?\n\nEle deixará de aparecer para o NOC e para o atendente N1. O registro continuará preservado no histórico.`,
    );
  }

  async function closeOperationalGrouping(incident: OperationalIncident) {
    if (!confirmGroupingClosure(incident.title)) return;

    setClosingGrouping(incident.incident_id);
    setError("");
    setCreated("");
    setClosedGrouping("");
    try {
      await api.closeOperationalIncident(incident.incident_id);
      setClosedGrouping(incident.incident_id);
      await refresh();
      setSelectedGroupingId("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha ao encerrar o agrupamento",
      );
    } finally {
      setClosingGrouping("");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const requiredSelections: Array<[IncidentOptionType, string]> = [];
    if (["olt", "pon", "cto"].includes(form.scopeType)) {
      requiredSelections.push(["olt", form.olt]);
    }
    if (["pon", "cto"].includes(form.scopeType)) {
      requiredSelections.push(["pon", form.pon]);
    }
    if (form.scopeType === "cto") {
      requiredSelections.push(["cto", form.cto]);
    }
    if (
      ["customer", "firmware", "equipment", "region"].includes(form.scopeType)
    ) {
      requiredSelections.push([
        form.scopeType as IncidentOptionType,
        form.identifier,
      ]);
    }
    const invalidSelection = requiredSelections.some(
      ([type, value]) =>
        !catalogOptions[type].some(
          (option) => option.value.toLowerCase() === value.toLowerCase(),
        ),
    );
    if (catalogLoading || invalidSelection) {
      setError("Selecione valores cadastrados nas listas de sugestões.");
      return;
    }
    setBusy(true);
    setError("");
    setCreated("");
    setClosedGrouping("");
    try {
      const result = await api.createOperationalIncident(form);
      setCreated(result.incident_id);
      setForm((current) => ({ ...initialForm, openedBy: current.openedBy }));
      await refresh();
      setModalOpen(false);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Falha ao criar agrupamento",
      );
    } finally {
      setBusy(false);
    }
  }

  const needsOlt = ["olt", "pon", "cto"].includes(form.scopeType);
  const needsPon = ["pon", "cto"].includes(form.scopeType);
  const needsCto = form.scopeType === "cto";
  const needsIdentifier = [
    "customer",
    "firmware",
    "equipment",
    "region",
  ].includes(form.scopeType);
  const identifierOptions = needsIdentifier
    ? catalogOptions[form.scopeType as IncidentOptionType]
    : [];
  const hasSelectedOlt = catalogOptions.olt.some(
    (option) => option.value.toLowerCase() === form.olt.toLowerCase(),
  );
  const hasSelectedPon = catalogOptions.pon.some(
    (option) => option.value.toLowerCase() === form.pon.toLowerCase(),
  );
  const selectedGrouping = incidents?.data.find(
    (incident) => incident.incident_id === selectedGroupingId,
  );
  const selectedGroupingData = selectedGrouping
    ? operationalGrouping(selectedGrouping)
    : null;
  return (
    <>
      <section className="incidents-section">
        <div className="section-heading">
          <div>
            <span className="section-label">
              Agrupamentos detectados
              <HelpTooltip
                term="Agrupamento detectado"
                description="Problema compartilhado identificado pelos sinais analíticos ou registrado pelo NOC. A atuação acontece no ponto comum afetado."
              />
            </span>
            <h2>Onde agir primeiro</h2>
          </div>
          <div className="grouping-heading-actions">
            <button
              type="button"
              className="noc-ticket-counter"
              onClick={onOpenNocTickets}
              title="Abrir a fila de Tickets já filtrada para pendências do NOC"
            >
              <span aria-hidden="true" />
              <strong>{nocTicketCount}</strong>
              {nocTicketCount === 1
                ? " ticket atribuído ao NOC"
                : " tickets atribuídos ao NOC"}
              <ArrowRight size={15} aria-hidden="true" />
            </button>
            <span>{incidents?.totalItems ?? 0} grupos ativos</span>
            <button className="noc-open-incident" onClick={openCreateGrouping}>
              <Plus size={16} /> Criar agrupamento
            </button>
          </div>
        </div>

        {created && (
          <p className="noc-form-success">
            <CheckCircle2 size={15} /> Agrupamento {created} criado e impacto
            calculado pelo inventário.
          </p>
        )}

        {closedGrouping && (
          <p className="noc-form-success">
            <CheckCircle2 size={15} /> Agrupamento {closedGrouping} encerrado
            nas visões ativas do NOC e do N1.
          </p>
        )}

        {showGroupingAgent && (
          <InvestigationReview
            onGroupingChanged={() => void refresh()}
            onOpenAssistant={onOpenAssistant}
            onOpenTopology={(investigation) => {
              const focus = topologyFocusFromInvestigation(investigation);
              if (focus) setTopologyGrouping(focus);
            }}
          />
        )}

        <div className="incidents-list">
          {incidents?.data.map((incident) => (
            <GroupingCard
              key={incident.incident_id}
              grouping={operationalGrouping(incident)}
              onOpen={() => setSelectedGroupingId(incident.incident_id)}
            />
          ))}
        </div>
      </section>

      {selectedGrouping && selectedGroupingData && (
        <SideDrawer
          className={`grouping-detail-modal grouping-detail-drawer ${selectedGroupingData.severity}`}
          backdropClassName="grouping-detail-backdrop"
          labelledBy="grouping-detail-title"
          closeLabel="Fechar detalhes do agrupamento"
          closeDisabled={Boolean(closingGrouping)}
          onClose={() => setSelectedGroupingId("")}
        >
          <header className="grouping-detail-header">
            <div>
              <div className="investigation-tags">
                <span>Agrupamento ativo</span>
                <span
                  className={`active-grouping-severity ${selectedGroupingData.severity}`}
                >
                  {severityLabels[selectedGroupingData.severity]}
                </span>
              </div>
              <h2 id="grouping-detail-title">
                <TechnicalText text={selectedGroupingData.title} />
              </h2>
              <small>{selectedGroupingData.id}</small>
            </div>
            <div className="investigation-confidence">
              <strong>{selectedGroupingData.confidence}</strong>
              <span>confiança da correlação</span>
              <small>
                Estimativa calculada a partir dos sinais que sustentam este
                agrupamento.
              </small>
            </div>
          </header>

          <div className="grouping-detail-content">
            <div className="grouping-detail-overview">
              <div>
                <span>Alcance</span>
                <strong className="grouping-detail-scope-value">
                  <GroupingScopePath location={selectedGroupingData.location} />
                </strong>
                <small>Escopo comum investigado</small>
              </div>
              <div>
                <span>Impacto estimado</span>
                <strong>
                  {selectedGroupingData.affected.toLocaleString("pt-BR")} CPEs
                </strong>
                <small>Potencialmente afetadas</small>
              </div>
              <div>
                <span>Responsável</span>
                <strong className="grouping-detail-owner-value">
                  <TechnicalText text={selectedGroupingData.owner} />
                </strong>
                <small>{selectedGroupingData.origin}</small>
              </div>
              <div>
                <span>Chamado de origem</span>
                <strong>
                  {selectedGroupingData.originTicketId ?? "Sem vínculo"}
                </strong>
                <small>Referência preservada no histórico</small>
              </div>
            </div>

            <div className="grouping-detail-analysis">
              <section>
                <span>Causa provável</span>
                <p>
                  <TechnicalText text={selectedGroupingData.signal} />
                </p>
              </section>
              <section>
                <span>Orientação operacional</span>
                <ul className="grouping-action-list">
                  {recommendedActionSteps(
                    selectedGroupingData.recommendation,
                  ).map((action) => (
                    <li key={`${action.label}-${action.text}`}>
                      <strong>{action.label}</strong>
                      <p>
                        <TechnicalText text={action.text} />
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="grouping-detail-evidence">
              <div>
                <span>Evidências disponíveis</span>
                <p>
                  Resumo dos sinais registrados para este agrupamento. As
                  referências técnicas permanecem acessíveis sem expor dados
                  brutos como conteúdo principal.
                </p>
              </div>
              {selectedGroupingData.evidence.length > 0 ? (
                <ul>
                  {selectedGroupingData.evidence.map((item, index) => (
                    <li key={`${selectedGroupingData.id}-${index}`}>
                      <CheckCircle2 size={15} aria-hidden="true" />
                      <div>
                        <strong>
                          {evidenceSourceLabel[item.source] ??
                            "Evidência operacional"}
                        </strong>
                        <p>
                          <TechnicalText text={item.summary} />
                        </p>
                        {item.reference && <small>{item.reference}</small>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="grouping-detail-empty">
                  Nenhuma evidência complementar foi registrada para este
                  agrupamento.
                </p>
              )}
            </section>

            {showGroupingAgent && (
              <InfrastructureAiAnalysis
                analysis={selectedAnalysis}
                loading={analysisLoading}
                error={analysisError}
              />
            )}

            <footer className="grouping-detail-actions">
              <p>
                Encerrar remove o agrupamento das visões ativas do NOC e do N1,
                mantendo o histórico para auditoria.
              </p>
              <div>
                {onOpenAssistant && (
                  <OpenIrisChatButton
                    compact
                    label="Conversar sobre este problema"
                    onClick={() =>
                      onOpenAssistant({
                        view: "Visão NOC",
                        entity: "problem",
                        selection: `${selectedGroupingData.id} · ${selectedGroupingData.title} · escopo ${selectedGroupingData.location}`,
                        problemId: selectedGroupingData.id,
                      })
                    }
                  />
                )}
                <button
                  type="button"
                  className="grouping-topology-open"
                  onClick={() =>
                    setTopologyGrouping(
                      topologyFocusFromIncident(selectedGrouping),
                    )
                  }
                >
                  <Network size={15} aria-hidden="true" />
                  Ver infraestrutura afetada
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setSelectedGroupingId("")}
                  disabled={Boolean(closingGrouping)}
                >
                  Fechar
                </button>
                <button
                  type="button"
                  className="close-grouping"
                  onClick={() =>
                    void closeOperationalGrouping(selectedGrouping)
                  }
                  disabled={closingGrouping === selectedGrouping.incident_id}
                >
                  <CheckCircle2 size={15} aria-hidden="true" />
                  <span>
                    {closingGrouping === selectedGrouping.incident_id
                      ? "Encerrando…"
                      : "Encerrar agrupamento"}
                  </span>
                </button>
              </div>
            </footer>
          </div>
        </SideDrawer>
      )}

      {topologyGrouping && (
        <PhysicalTopology
          focus={topologyGrouping}
          onClose={() => setTopologyGrouping(null)}
        />
      )}

      {modalOpen && (
        <div
          className="entity-modal-backdrop noc-incident-backdrop"
          role="presentation"
          onMouseDown={() => !busy && setModalOpen(false)}
        >
          <section
            className="noc-incident-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="noc-incident-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="entity-modal-close"
              type="button"
              onClick={() => setModalOpen(false)}
              aria-label="Fechar criação de agrupamento"
              title="Fecha a janela sem criar o agrupamento."
              disabled={busy}
            >
              <X size={19} />
            </button>
            <form
              id="noc-incident-form"
              className="noc-incident-form"
              onSubmit={submit}
            >
              <header>
                <div>
                  <span className="section-label">Decisão do operador</span>
                  <h3 id="noc-incident-title">Criar agrupamento</h3>
                  <p>
                    Defina o ponto comum; o sistema calcula as CPEs
                    potencialmente afetadas antes de registrar o caso.
                  </p>
                </div>
                <Network size={24} />
              </header>
              {form.originTicketId && (
                <div className="noc-origin-ticket">
                  <TicketCheck size={15} /> Origem: {form.originTicketId}
                  <button
                    type="button"
                    aria-label="Remover vínculo com o chamado de origem"
                    onClick={() => update("originTicketId", null)}
                  >
                    remover vínculo
                  </button>
                </div>
              )}
              <div className="noc-form-grid">
                <label>
                  Responsável do NOC
                  <input
                    value={form.openedBy}
                    onChange={(event) => update("openedBy", event.target.value)}
                    placeholder="Nome ou matrícula"
                    maxLength={100}
                    required
                  />
                </label>
                <label>
                  Severidade
                  <select
                    value={form.severity}
                    onChange={(event) =>
                      update(
                        "severity",
                        event.target.value as typeof form.severity,
                      )
                    }
                  >
                    {Object.entries(severityLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="noc-wide-field">
                  Título do agrupamento
                  <input
                    value={form.title}
                    onChange={(event) => update("title", event.target.value)}
                    placeholder="Ex.: perda de sinal compartilhada no Jardim Aurora"
                    minLength={5}
                    maxLength={160}
                    required
                  />
                </label>
                <label>
                  Área de impacto
                  <span className="label-with-help">
                    Tipo de escopo
                    <HelpTooltip
                      term="Escopo do agrupamento"
                      description="Define o ponto comum usado para calcular as CPEs potencialmente afetadas: parque, OLT, PON, CTO, cliente ou grupo lógico."
                    />
                  </span>
                  <select
                    value={form.scopeType}
                    onChange={(event) =>
                      updateScope(event.target.value as ScopeType)
                    }
                  >
                    {Object.entries(scopeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {needsOlt && (
                  <label>
                    <span className="label-with-help">
                      OLT
                      <HelpTooltip
                        term="OLT"
                        description={providerGlossary.olt.description}
                      />
                    </span>
                    <input
                      list="noc-olt-options"
                      value={form.olt}
                      onChange={(event) => updateOlt(event.target.value)}
                      placeholder="Digite para buscar uma OLT"
                      autoComplete="off"
                      aria-describedby="noc-olt-hint"
                      required
                    />
                    <datalist id="noc-olt-options">
                      {catalogOptions.olt.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          label={option.label}
                        />
                      ))}
                    </datalist>
                    <small id="noc-olt-hint" className="catalog-field-note">
                      Selecione uma OLT cadastrada.
                    </small>
                  </label>
                )}
                {needsPon && (
                  <label>
                    <span className="label-with-help">
                      PON
                      <HelpTooltip
                        term="PON"
                        description={providerGlossary.pon.description}
                      />
                    </span>
                    <input
                      list="noc-pon-options"
                      value={form.pon}
                      onChange={(event) => updatePon(event.target.value)}
                      placeholder={
                        hasSelectedOlt
                          ? "Digite para buscar uma PON"
                          : "Selecione primeiro uma OLT cadastrada"
                      }
                      autoComplete="off"
                      aria-describedby="noc-pon-hint"
                      disabled={!hasSelectedOlt}
                      title={
                        hasSelectedOlt
                          ? "Selecione uma PON cadastrada na OLT escolhida."
                          : "Selecione uma OLT cadastrada para habilitar este campo."
                      }
                      required
                    />
                    <datalist id="noc-pon-options">
                      {catalogOptions.pon.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          label={option.label}
                        />
                      ))}
                    </datalist>
                    <small id="noc-pon-hint" className="catalog-field-note">
                      {hasSelectedOlt
                        ? "Lista filtrada pela OLT escolhida."
                        : "Campo bloqueado até selecionar uma OLT cadastrada."}
                    </small>
                  </label>
                )}
                {needsCto && (
                  <label>
                    <span className="label-with-help">
                      CTO
                      <HelpTooltip
                        term="CTO"
                        description={providerGlossary.cto.description}
                      />
                    </span>
                    <input
                      list="noc-cto-options"
                      value={form.cto}
                      onChange={(event) => update("cto", event.target.value)}
                      placeholder={
                        hasSelectedPon
                          ? "Digite para buscar uma CTO"
                          : "Selecione primeiro uma OLT e uma PON cadastradas"
                      }
                      autoComplete="off"
                      aria-describedby="noc-cto-hint"
                      disabled={!hasSelectedOlt || !hasSelectedPon}
                      title={
                        hasSelectedOlt && hasSelectedPon
                          ? "Selecione uma CTO cadastrada na PON escolhida."
                          : "Selecione uma OLT e uma PON cadastradas para habilitar este campo."
                      }
                      required
                    />
                    <datalist id="noc-cto-options">
                      {catalogOptions.cto.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          label={option.label}
                        />
                      ))}
                    </datalist>
                    <small id="noc-cto-hint" className="catalog-field-note">
                      {hasSelectedOlt && hasSelectedPon
                        ? "Lista filtrada pela OLT e PON escolhidas."
                        : "Campo bloqueado até selecionar uma OLT e uma PON cadastradas."}
                    </small>
                  </label>
                )}
                {needsIdentifier && (
                  <label>
                    <span className="label-with-help">
                      {scopeLabels[form.scopeType]}
                      {form.scopeType === "customer" && (
                        <HelpTooltip
                          term="CPE"
                          description={providerGlossary.cpe.description}
                        />
                      )}
                    </span>
                    <input
                      list={`noc-${form.scopeType}-options`}
                      value={form.identifier}
                      onChange={(event) =>
                        update("identifier", event.target.value)
                      }
                      placeholder={
                        form.scopeType === "customer"
                          ? "Cliente ou serial"
                          : form.scopeType === "firmware"
                            ? "Digite para buscar um firmware"
                            : form.scopeType === "equipment"
                              ? "Digite fabricante ou modelo"
                              : "Digite uma cidade ou bairro"
                      }
                      autoComplete="off"
                      aria-describedby="noc-identifier-hint"
                      required
                    />
                    <datalist id={`noc-${form.scopeType}-options`}>
                      {identifierOptions.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          label={option.label}
                        />
                      ))}
                    </datalist>
                    <small
                      id="noc-identifier-hint"
                      className="catalog-field-note"
                    >
                      {form.scopeType === "customer"
                        ? "Digite ao menos 2 caracteres e selecione o cliente cadastrado."
                        : "Selecione uma opção cadastrada."}
                    </small>
                  </label>
                )}
                <label className="noc-wide-field">
                  Causa ou hipótese
                  <textarea
                    value={form.probableCause}
                    onChange={(event) =>
                      update("probableCause", event.target.value)
                    }
                    minLength={5}
                    maxLength={600}
                    required
                  />
                </label>
                <label className="noc-wide-field">
                  Próxima ação
                  <textarea
                    value={form.recommendedAction}
                    onChange={(event) =>
                      update("recommendedAction", event.target.value)
                    }
                    minLength={5}
                    maxLength={600}
                    required
                  />
                </label>
              </div>
              {error && (
                <p className="noc-operations-error">
                  <AlertTriangle size={15} /> {error}
                </p>
              )}
              {catalogError && (
                <p className="noc-operations-error">
                  <AlertTriangle size={15} /> {catalogError}
                </p>
              )}
              <div className="noc-modal-actions">
                <button
                  className="noc-cancel-incident"
                  type="button"
                  disabled={busy}
                  onClick={() => setModalOpen(false)}
                >
                  Cancelar
                </button>
                <button className="noc-create-incident" disabled={busy}>
                  <Network size={16} />
                  {busy ? "Criando…" : "Criar agrupamento"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {error && !modalOpen && (
        <p className="noc-operations-error">
          <AlertTriangle size={15} /> {error}
        </p>
      )}
    </>
  );
}
