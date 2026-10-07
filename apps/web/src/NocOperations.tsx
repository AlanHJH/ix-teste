import { FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Network,
  Plus,
  TicketCheck,
  X,
} from "lucide-react";
import { api } from "./api";
import { HelpTooltip } from "./HelpTooltip";
import { InvestigationReview } from "./InvestigationReview";
import { groupingAgentEnabled, useAgentPolicy } from "./agentPolicy";
import { providerGlossary, TechnicalText } from "./ProviderGlossary";
import type {
  IncidentOptionType,
  OperationalIncident,
  OperationalIncidentPage,
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
  evidence: string[];
  origin: string;
  originTicketId: string | null;
};

function operationalGrouping(incident: OperationalIncident): GroupingCardData {
  const evidence = incident.evidence
    .map((record) =>
      Object.values(record)
        .filter((value): value is string => typeof value === "string")
        .join(" · "),
    )
    .filter(Boolean);

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

function GroupingCard({
  grouping,
  closing,
  onClose,
}: {
  grouping: GroupingCardData;
  closing: boolean;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className={`incident-card grouping-card ${grouping.severity}`}>
      <header>
        <div className="incident-title">
          <span className="scope-icon">
            <Network size={19} aria-hidden="true" />
          </span>
          <div>
            <div className="eyebrow-row">
              <span className={`severity ${grouping.severity}`}>
                {severityLabels[grouping.severity]}
              </span>
              <span className="scope-label">
                Agrupamento ativo
                <HelpTooltip
                  term="Agrupamento ativo"
                  description="Problema compartilhado que reúne clientes por uma causa ou parte da rede em comum."
                />
              </span>
              <span>{grouping.id}</span>
            </div>
            <h3>
              <TechnicalText text={grouping.title} />
            </h3>
            <p>
              <TechnicalText text={grouping.location} />
            </p>
          </div>
        </div>
        <div className="score">
          <strong>{grouping.confidence}</strong>
          <span>confiança</span>
        </div>
      </header>
      <div className="incident-stats">
        <div>
          <strong>{grouping.affected.toLocaleString("pt-BR")}</strong>
          <span>
            CPEs afetadas
            <HelpTooltip
              term="CPEs potencialmente afetadas"
              description="Quantidade calculada no inventário para o escopo definido. Representa impacto potencial, não confirmação individual."
            />
          </span>
        </div>
        <div>
          <strong>
            <TechnicalText text={grouping.signal} />
          </strong>
          <span>Sinal dominante</span>
        </div>
        <div>
          <strong>
            <TechnicalText text={grouping.owner} />
          </strong>
          <span>Responsável</span>
        </div>
      </div>
      <div className="recommendation">
        <ArrowRight size={17} aria-hidden="true" />
        <p>
          <strong>Próxima ação</strong>
          <TechnicalText text={grouping.recommendation} />
        </p>
      </div>
      {expanded && grouping.evidence.length > 0 && (
        <ul className="evidence">
          {grouping.evidence.map((item, index) => (
            <li key={`${grouping.id}-${index}`}>
              <CheckCircle2 size={15} aria-hidden="true" />
              <TechnicalText text={item} />
            </li>
          ))}
        </ul>
      )}
      <footer className="grouping-card-footer">
        <div className="grouping-card-metadata">
          <span>Origem: {grouping.origin}</span>
          {grouping.originTicketId && (
            <span>Chamado vinculado: {grouping.originTicketId}</span>
          )}
        </div>
        <div className="grouping-card-actions">
          {grouping.evidence.length > 0 && (
            <button
              type="button"
              className="text-button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
            >
              {expanded ? "Ocultar evidências" : "Ver evidências"}
            </button>
          )}
          <button
            type="button"
            className="close-grouping"
            onClick={onClose}
            disabled={closing}
            aria-label={`Encerrar agrupamento ${grouping.title}`}
            title="Encerra o agrupamento nas visões do NOC e do N1, preservando o histórico."
          >
            <CheckCircle2 size={15} aria-hidden="true" />
            <span>{closing ? "Encerrando…" : "Encerrar"}</span>
          </button>
        </div>
      </footer>
    </article>
  );
}

export function NocOperations({
  nocTicketCount,
  onOpenNocTickets,
}: {
  nocTicketCount: number;
  onOpenNocTickets: () => void;
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
            mode="noc"
            onGroupingChanged={() => void refresh()}
          />
        )}

        <div className="incidents-list">
          {incidents?.data.map((incident) => (
            <GroupingCard
              key={incident.incident_id}
              grouping={operationalGrouping(incident)}
              closing={closingGrouping === incident.incident_id}
              onClose={() => void closeOperationalGrouping(incident)}
            />
          ))}
        </div>
      </section>

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
