import { useEffect, useState } from "react";
import { Boxes, Cable, GitBranch, MapPin, Server } from "lucide-react";
import { api } from "./api";
import { EntityDetailModal } from "./EntityDetailModal";
import type { EntityDetailItem } from "./EntityDetailModal";
import { providerGlossary } from "./ProviderGlossary";
import type { EquipmentPath, Investigation, TopologySnapshot } from "./types";

type Olt = TopologySnapshot["olts"][number];
type Pon = TopologySnapshot["pons"][number];
type Cto = TopologySnapshot["ctos"][number];

export type NetworkEntity =
  | { kind: "olt"; data: Olt }
  | { kind: "pon"; olt: string; data: Pon }
  | { kind: "cto"; olt: string; pon: string; data: Cto }
  | { kind: "cpe"; data: EquipmentPath };

export type DirectChildrenAction = {
  count: number;
  label: string;
  expanded: boolean;
  onExpand: () => void;
};

const number = new Intl.NumberFormat("pt-BR");

const detailHints: Record<string, string> = {
  "Portas PON ativas": providerGlossary.pon.description,
  "CTOs atendidas": providerGlossary.cto.description,
  "CTOs conectadas": providerGlossary.cto.description,
  "CPEs ativas": providerGlossary.cpe.description,
  "OLT de origem": providerGlossary.olt.description,
  "Porta PON": providerGlossary.pon.description,
  "Drop lógico": providerGlossary.drop.description,
  "Relações de drop": providerGlossary.drop.description,
  Firmware: providerGlossary.firmware.description,
  Equipamento: providerGlossary.hardware.description,
  "Plano contratado": providerGlossary.mbps.description,
  Caminho: providerGlossary.logicalTopology.description,
};

type HistoryState =
  "problem" | "no-problem" | "inconclusive" | "running" | "failed";

type HistoryScope = {
  type?: string;
  identifier?: string;
  olt?: string | null;
  pon?: string | null;
  cto?: string | null;
};

type EntityPath = {
  olt?: string;
  pon?: string;
  cto?: string;
  serial?: string;
  customerId?: string;
  equipment?: string;
  firmware?: string;
};

const investigationStatuses: Investigation["status"][] = [
  "queued",
  "running",
  "no_problem",
  "inconclusive",
  "pending_review",
  "approved",
  "rejected",
  "failed",
];

const historyStatusLabels: Record<Investigation["status"], string> = {
  queued: "Na fila",
  running: "Em análise",
  no_problem: "Sem problema",
  inconclusive: "Inconclusivo",
  pending_review: "Aguardando revisão",
  approved: "Aprovado",
  rejected: "Descartado",
  failed: "Falhou",
};

const historyStateLabels: Record<HistoryState, string> = {
  problem: "Problema identificado",
  "no-problem": "Nenhum problema identificado",
  inconclusive: "Resultado inconclusivo",
  running: "Análise em andamento",
  failed: "Análise falhou",
};

function normalize(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("pt-BR") ?? "";
}

function entityPath(entity: NetworkEntity): EntityPath {
  if (entity.kind === "olt") return { olt: entity.data.olt };
  if (entity.kind === "pon") {
    return { olt: entity.olt, pon: entity.data.pon };
  }
  if (entity.kind === "cto") {
    return { olt: entity.olt, pon: entity.pon, cto: entity.data.cto };
  }
  return {
    olt: entity.data.olt,
    pon: entity.data.pon,
    cto: entity.data.cto,
    serial: entity.data.serial,
    customerId: entity.data.customer_id,
    equipment: `${entity.data.vendor} ${entity.data.model}`,
    firmware: entity.data.software_version,
  };
}

function investigationScope(investigation: Investigation): HistoryScope {
  const scope = investigation.finding?.scope ?? investigation.scope;
  if (!scope || typeof scope !== "object") return {};

  const value = scope as Record<string, unknown>;
  return {
    type: typeof value.type === "string" ? value.type : undefined,
    identifier:
      typeof value.identifier === "string" ? value.identifier : undefined,
    olt: typeof value.olt === "string" ? value.olt : null,
    pon: typeof value.pon === "string" ? value.pon : null,
    cto: typeof value.cto === "string" ? value.cto : null,
  };
}

function matchesEntity(
  investigation: Investigation,
  entity: NetworkEntity,
): boolean {
  const scope = investigationScope(investigation);
  const path = entityPath(entity);
  const type = normalize(scope.type);

  if (scope.olt && path.olt && normalize(scope.olt) !== normalize(path.olt)) {
    return false;
  }
  if (scope.pon && path.pon && normalize(scope.pon) !== normalize(path.pon)) {
    return false;
  }
  if (scope.cto && path.cto && normalize(scope.cto) !== normalize(path.cto)) {
    return false;
  }

  if (["park", "region", "network"].includes(type)) return true;

  const identifier = normalize(scope.identifier);
  if (["equipment", "firmware", "customer"].includes(type)) {
    // Uma análise sem localização representa um padrão do parque. Ela deve
    // aparecer também nos níveis superiores para não esconder um risco que
    // afeta os descendentes daquele nó.
    if (
      !scope.olt &&
      !scope.pon &&
      !scope.cto &&
      ["equipment", "firmware"].includes(type) &&
      entity.kind !== "cpe"
    ) {
      return true;
    }
    if (entity.kind !== "cpe" || !identifier) return false;

    if (type === "customer") {
      return identifier === normalize(path.customerId);
    }
    if (type === "firmware") {
      return identifier === normalize(path.firmware);
    }

    const equipment = normalize(path.equipment);
    return (
      identifier === equipment ||
      equipment.includes(identifier) ||
      identifier.includes(equipment)
    );
  }

  if (type === "olt") {
    return (
      Boolean(scope.olt) || !identifier || normalize(path.olt) === identifier
    );
  }
  if (type === "pon") {
    return (
      Boolean(scope.pon) || !identifier || normalize(path.pon) === identifier
    );
  }
  if (type === "cto") {
    return (
      Boolean(scope.cto) || !identifier || normalize(path.cto) === identifier
    );
  }

  // Escopos sem tipo explícito ainda podem ser relacionados pela hierarquia
  // informada pelo agente. Isso mantém registros antigos visíveis.
  return Boolean(scope.olt || scope.pon || scope.cto);
}

function historyState(investigation: Investigation): HistoryState {
  if (investigation.status === "failed") return "failed";
  if (["queued", "running"].includes(investigation.status)) {
    return "running";
  }
  if (investigation.finding?.problemDetected === true) return "problem";
  if (investigation.status === "no_problem") return "no-problem";
  if (investigation.status === "inconclusive") return "inconclusive";
  if (investigation.finding?.problemDetected === false) return "no-problem";
  return "inconclusive";
}

function historyTitle(investigation: Investigation) {
  return investigation.finding?.title || investigation.trigger_label;
}

function historySummary(investigation: Investigation) {
  return (
    investigation.finding?.summary ||
    investigation.error ||
    investigation.objective ||
    "Não foi registrado um resumo para esta análise."
  );
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function NetworkEntityHistory({ entity }: { entity: NetworkEntity }) {
  const [records, setRecords] = useState<Investigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedRequests, setFailedRequests] = useState(0);

  const entityKey = [
    entity.kind,
    ...Object.values(entity.data).map((value) => String(value)),
  ].join(":");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRecords([]);
    setFailedRequests(0);

    void Promise.allSettled(
      investigationStatuses.map((status) => api.investigations(status)),
    ).then((results) => {
      if (cancelled) return;

      const failed = results.filter(
        (result) => result.status === "rejected",
      ).length;
      const unique = new Map<string, Investigation>();
      results.forEach((result) => {
        if (result.status !== "fulfilled") return;
        result.value.data.forEach((investigation) => {
          unique.set(investigation.investigation_id, investigation);
        });
      });

      setFailedRequests(failed);
      setRecords(
        [...unique.values()]
          .filter((investigation) => matchesEntity(investigation, entity))
          .sort(
            (left, right) =>
              new Date(right.created_at).getTime() -
              new Date(left.created_at).getTime(),
          ),
      );
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [entity, entityKey]);

  return (
    <section className="entity-history" aria-labelledby="entity-history-title">
      <div className="entity-history-header">
        <div>
          <span className="entity-history-label">
            Rastreabilidade operacional
          </span>
          <h4 id="entity-history-title">Histórico de análises dos agentes</h4>
        </div>
        {!loading && (
          <span className="entity-history-count">{records.length}</span>
        )}
      </div>
      <p className="entity-history-description">
        Problemas identificados, análises sem problema e resultados
        inconclusivos relacionados a este ponto e aos seus descendentes.
      </p>

      {loading && (
        <p className="entity-history-loading" role="status">
          Consultando o histórico…
        </p>
      )}

      {!loading && records.length === 0 && (
        <p className="entity-history-empty">
          Nenhuma análise relacionada foi encontrada para este nó.
        </p>
      )}

      {!loading && records.length > 0 && (
        <ol className="entity-history-list">
          {records.map((investigation) => {
            const state = historyState(investigation);
            const finding = investigation.finding;
            return (
              <li
                className="entity-history-entry"
                key={investigation.investigation_id}
              >
                <div className="entity-history-entry-head">
                  <span className={`entity-history-state ${state}`}>
                    {historyStateLabels[state]}
                  </span>
                  <time dateTime={investigation.created_at}>
                    {formatHistoryDate(investigation.created_at)}
                  </time>
                </div>
                <strong>{historyTitle(investigation)}</strong>
                <p>{historySummary(investigation)}</p>
                <div className="entity-history-entry-meta">
                  <span>{historyStatusLabels[investigation.status]}</span>
                  {finding && (
                    <span>
                      {Math.round(
                        finding.confidence <= 1
                          ? finding.confidence * 100
                          : finding.confidence,
                      )}
                      % de confiança
                    </span>
                  )}
                  <span>ID {investigation.investigation_id}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {failedRequests > 0 && (
        <p className="entity-history-warning">
          Parte do histórico não pôde ser consultada agora. Os registros
          disponíveis continuam exibidos.
        </p>
      )}
    </section>
  );
}

export function NetworkEntityModal({
  entity,
  onClose,
  directChildren,
}: {
  entity: NetworkEntity;
  onClose: () => void;
  directChildren?: DirectChildrenAction;
}) {
  let icon = <Boxes size={22} />;
  let eyebrow = "CPE / equipamento do cliente";
  let title = entity.kind === "cpe" ? entity.data.serial : "";
  let subtitle =
    entity.kind === "cpe" ? `Cliente ${entity.data.customer_id}` : "";
  let details: EntityDetailItem[] = [];

  if (entity.kind === "olt") {
    icon = <Server size={22} />;
    eyebrow = "Equipamento de acesso";
    title = entity.data.olt;
    subtitle = entity.data.cities.join(" · ");
    details = [
      { label: "Portas PON ativas", value: number.format(entity.data.pons) },
      { label: "CTOs atendidas", value: number.format(entity.data.ctos) },
      { label: "CPEs ativas", value: number.format(entity.data.cpes) },
      {
        label: "Bairros cobertos",
        value: entity.data.neighborhoods.join(" · "),
      },
    ];
  } else if (entity.kind === "pon") {
    icon = <Cable size={22} />;
    eyebrow = "Porta de acesso óptico";
    title = `PON ${entity.data.pon}`;
    subtitle = entity.olt;
    details = [
      { label: "OLT de origem", value: entity.olt },
      { label: "CTOs conectadas", value: number.format(entity.data.ctos) },
      { label: "CPEs ativas", value: number.format(entity.data.cpes) },
      { label: "Tipo de vínculo", value: "Porta PON compartilhada" },
    ];
  } else if (entity.kind === "cto") {
    icon = <MapPin size={22} />;
    eyebrow = "Caixa de distribuição óptica";
    title = entity.data.cto;
    subtitle = `${entity.data.neighborhood} · ${entity.data.city}`;
    details = [
      { label: "OLT de origem", value: entity.olt },
      { label: "Porta PON", value: entity.pon },
      { label: "CPEs ativas", value: number.format(entity.data.cpes) },
      {
        label: "Relações de drop",
        value: "Estimadas por CPE; sem ID físico de campo",
      },
    ];
  } else {
    details = [
      {
        label: "Equipamento",
        value: `${entity.data.vendor} ${entity.data.model} · rev. ${entity.data.hw_revision}`,
      },
      { label: "Firmware", value: entity.data.software_version },
      {
        label: "Plano contratado",
        value: `${entity.data.plan_mbps} Mbps`,
      },
      {
        label: "Caminho",
        value: `${entity.data.olt} · PON ${entity.data.pon} · ${entity.data.cto}`,
      },
      {
        label: "Drop lógico",
        value: entity.data.logical_drop_id ?? "Indisponível",
      },
      {
        label: "Localidade",
        value: `${entity.data.neighborhood} · ${entity.data.city}`,
      },
    ];
  }

  details = details.map((detail) => ({
    ...detail,
    hint: detailHints[detail.label],
  }));

  return (
    <EntityDetailModal
      variant={entity.kind}
      icon={icon}
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      details={details}
      note={
        entity.kind === "cto"
          ? "Cada CPE ativa recebe um identificador lógico estimado. O identificador físico de campo de cada drop não foi fornecido pela fonte."
          : entity.kind === "cpe" && !entity.data.logical_drop_id
            ? "Este recorte do inventário não inclui o identificador de drop lógico. Os demais dados refletem o cadastro disponível para a CPE."
            : undefined
      }
      onClose={onClose}
    >
      {directChildren && (
        <div className="entity-modal-children">
          <div>
            <span>Próxima camada</span>
            <p>
              {directChildren.count} {directChildren.label}. A expansão mostra
              apenas os filhos diretos, sem abrir os níveis seguintes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              directChildren.onExpand();
              onClose();
            }}
            disabled={directChildren.expanded}
            title="Exibe somente os filhos diretos deste nó no grafo."
          >
            <GitBranch size={16} aria-hidden="true" />
            {directChildren.expanded
              ? "Filhos diretos exibidos"
              : `Exibir ${directChildren.count} ${directChildren.label}`}
          </button>
        </div>
      )}
      <NetworkEntityHistory entity={entity} />
    </EntityDetailModal>
  );
}
