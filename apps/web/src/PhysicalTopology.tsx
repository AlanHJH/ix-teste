import { useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { api } from "./api";
import { NetworkEntityModal } from "./NetworkEntityModal";
import type { NetworkEntity } from "./NetworkEntityModal";
import { NetworkExplorerGraph } from "./NetworkExplorerGraph";
import type {
  EquipmentPath,
  OperationalIncident,
  TopologyIssue,
  TopologySnapshot,
} from "./types";

function normalized(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("pt-BR") ?? "";
}

function focusIssue(grouping: OperationalIncident): TopologyIssue {
  const supportedTypes: TopologyIssue["scope"]["type"][] = [
    "park",
    "olt",
    "pon",
    "cto",
    "customer",
    "firmware",
    "equipment",
    "region",
    "network",
  ];
  const type = supportedTypes.includes(
    grouping.scope.type as TopologyIssue["scope"]["type"],
  )
    ? (grouping.scope.type as TopologyIssue["scope"]["type"])
    : "network";

  return {
    investigationId: grouping.incident_id,
    title: grouping.title,
    severity: grouping.severity,
    confidence: grouping.confidence,
    status: "approved",
    scope: {
      type,
      identifier: grouping.scope.identifier,
      olt: grouping.scope.olt ?? null,
      pon: grouping.scope.pon ?? null,
      cto: grouping.scope.cto ?? null,
    },
    affectedCpes: grouping.affected_cpes,
  };
}

function focusMatchesDevice(
  grouping: OperationalIncident,
  device: EquipmentPath,
) {
  const scope = grouping.scope;
  if (scope.olt && normalized(scope.olt) !== normalized(device.olt)) {
    return false;
  }
  if (scope.pon && normalized(scope.pon) !== normalized(device.pon)) {
    return false;
  }
  if (scope.cto && normalized(scope.cto) !== normalized(device.cto)) {
    return false;
  }

  const identifier = normalized(scope.identifier);
  if (scope.type === "customer") {
    return normalized(device.customer_id) === identifier;
  }
  if (scope.type === "firmware") {
    return normalized(device.software_version) === identifier;
  }
  if (scope.type === "equipment") {
    const equipment = normalized(
      device.vendor + " " + device.model + " " + device.hw_revision,
    );
    return (
      equipment.includes(identifier) ||
      identifier.includes(equipment) ||
      normalized(device.serial) === identifier
    );
  }
  if (scope.type === "region") {
    return [device.city, device.neighborhood]
      .map(normalized)
      .some((value) => value === identifier || value.includes(identifier));
  }
  return true;
}

function focusPoints(grouping: OperationalIncident) {
  const scope = grouping.scope;
  const points: Array<{ kind: string; value: string }> = [];
  const inferredOlt =
    scope.olt ?? (scope.type === "olt" ? scope.identifier.split(" · ")[0] : "");

  if (inferredOlt) points.push({ kind: "OLT", value: inferredOlt });
  if (scope.pon) points.push({ kind: "PON", value: scope.pon });
  if (scope.cto) points.push({ kind: "CTO", value: scope.cto });
  if (points.length === 0) {
    points.push({ kind: "Escopo", value: scope.identifier });
  }
  return points;
}

function TopologyImpactSummary({
  grouping,
  devicesByCto,
}: {
  grouping: OperationalIncident;
  devicesByCto: Record<string, EquipmentPath[]>;
}) {
  const affectedDevices = Object.values(devicesByCto)
    .flat()
    .filter((device) => focusMatchesDevice(grouping, device))
    .filter(
      (device, index, all) =>
        all.findIndex((item) => item.serial === device.serial) === index,
    );
  const points = focusPoints(grouping);

  return (
    <section
      className="topology-impact-summary"
      aria-labelledby="topology-impact-title"
    >
      <header>
        <div>
          <span className="section-label">Impacto do agrupamento</span>
          <h2 id="topology-impact-title">
            Pontos e clientes potencialmente afetados
          </h2>
        </div>
        <strong>
          {grouping.affected_cpes.toLocaleString("pt-BR")} CPEs estimadas
        </strong>
      </header>
      <div className="topology-impact-grid">
        <div className="topology-impact-points">
          <span>Pontos da rota afetada</span>
          <div>
            {points.map((point, index) => (
              <span
                className="topology-impact-point"
                key={point.kind + "-" + point.value}
              >
                <b>{point.kind}</b>
                <strong>{point.value}</strong>
                {index < points.length - 1 && <i aria-hidden="true">→</i>}
              </span>
            ))}
          </div>
        </div>
        <div className="topology-impact-customers">
          <span>
            Clientes identificados no recorte ({affectedDevices.length})
          </span>
          {affectedDevices.length > 0 ? (
            <div>
              {affectedDevices.map((device) => (
                <span
                  className="topology-impact-customer"
                  key={device.serial}
                  title={"CPE " + device.serial}
                >
                  <strong>{device.customer_id}</strong>
                  <small>{device.serial}</small>
                </span>
              ))}
            </div>
          ) : (
            <p>
              Expanda a CTO correspondente para carregar os clientes deste
              escopo.
            </p>
          )}
        </div>
      </div>
      <small className="topology-impact-note">
        A lista representa o alcance calculado pelo inventário e pelo
        agrupamento; a confirmação da causa continua sendo operacional.
      </small>
    </section>
  );
}

export function PhysicalTopology({
  focusGrouping,
  onClose,
}: {
  focusGrouping?: OperationalIncident;
  onClose?: () => void;
}) {
  const [topology, setTopology] = useState<TopologySnapshot | null>(null);
  const [selectedOlt, setSelectedOlt] = useState("");
  const [selectedPon, setSelectedPon] = useState("");
  const [selectedCto, setSelectedCto] = useState("");
  const [selectedPath, setSelectedPath] = useState<EquipmentPath | null>(null);
  const [devicesByCto, setDevicesByCto] = useState<
    Record<string, EquipmentPath[]>
  >({});
  const [modalEntity, setModalEntity] = useState<NetworkEntity | null>(null);
  const [topologyIssues, setTopologyIssues] = useState<TopologyIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const activeBranch = useRef("");

  useEffect(() => {
    void loadInitialTopology();
    void loadTopologyIssues();
  }, [focusGrouping?.incident_id]);

  async function loadTopologyIssues() {
    try {
      const [pendingReview, approved] = await Promise.all([
        api.investigations("pending_review"),
        api.investigations("approved"),
      ]);
      const issues = [...pendingReview.data, ...approved.data].flatMap(
        (investigation) => {
          const finding = investigation.finding;
          if (
            !finding ||
            !finding.problemDetected ||
            !["pending_review", "approved"].includes(investigation.status)
          ) {
            return [];
          }

          return [
            {
              investigationId: investigation.investigation_id,
              title: finding.title,
              severity: finding.severity,
              confidence: finding.confidence,
              status: investigation.status,
              scope: finding.scope,
              affectedCpes: finding.affectedCpes,
            },
          ];
        },
      );
      setTopologyIssues(focusGrouping ? [focusIssue(focusGrouping)] : issues);
    } catch {
      // A falha nesta camada não impede a navegação pela topologia.
      setTopologyIssues([]);
    }
  }

  async function loadInitialTopology() {
    setLoading(true);
    setError("");
    try {
      const root = await api.topology();
      const scope = focusGrouping?.scope;
      const requestedOlt =
        scope?.olt ??
        (scope?.type === "olt" ? scope.identifier.split(" · ")[0] : "");
      const initialOlt =
        root.olts.find(
          (item) => normalized(item.olt) === normalized(requestedOlt),
        ) ??
        root.olts.find((item) => item.olt === "OLT-2") ??
        root.olts[0];

      if (!initialOlt) {
        setTopology(root);
        return;
      }

      await chooseOlt(initialOlt.olt);

      const requestedPon = scope?.pon;
      if (requestedPon) {
        await choosePon(initialOlt.olt, requestedPon);
      }

      if (requestedPon && scope?.cto) {
        await expandCto(initialOlt.olt, requestedPon, scope.cto);
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar a infraestrutura de rede",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!onClose) return;
    const close = onClose;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function chooseOlt(olt: string) {
    activeBranch.current = `${olt}:`;
    setLoading(true);
    setError("");
    setSelectedOlt(olt);
    setSelectedPon("");
    setSelectedCto("");
    setSelectedPath(null);
    setDevicesByCto({});
    setModalEntity(null);

    try {
      setTopology(await api.topology(olt));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar as portas PON",
      );
    } finally {
      setLoading(false);
    }
  }

  async function choosePon(olt: string, pon: string) {
    activeBranch.current = `${olt}:${pon}`;
    setLoading(true);
    setError("");
    setSelectedOlt(olt);
    setSelectedPon(pon);
    setSelectedCto("");
    setSelectedPath(null);
    setDevicesByCto({});

    try {
      setTopology(await api.topology(olt, pon));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar as CTOs",
      );
    } finally {
      setLoading(false);
    }
  }

  async function expandCto(olt: string, pon: string, cto: string) {
    const branch = `${olt}:${pon}`;
    activeBranch.current = branch;
    setError("");
    setSelectedOlt(olt);
    setSelectedPon(pon);
    setSelectedCto(cto);
    setSelectedPath(null);

    if (Object.prototype.hasOwnProperty.call(devicesByCto, cto)) return;

    setDevicesByCto((current) => ({ ...current, [cto]: [] }));
    try {
      const devices = await api.topologyDevices(olt, pon, cto);
      if (activeBranch.current !== branch) return;
      setDevicesByCto((current) => ({ ...current, [cto]: devices }));
    } catch (reason) {
      if (activeBranch.current !== branch) return;
      setDevicesByCto((current) => {
        const next = { ...current };
        delete next[cto];
        return next;
      });
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar as CPEs da CTO",
      );
    }
  }

  const directChildren = modalEntity
    ? modalEntity.kind === "olt"
      ? {
          count: modalEntity.data.pons,
          label: "PONs",
          expanded: selectedOlt === modalEntity.data.olt,
          onExpand: () => void chooseOlt(modalEntity.data.olt),
        }
      : modalEntity.kind === "pon"
        ? {
            count: modalEntity.data.ctos,
            label: "CTOs",
            expanded:
              selectedOlt === modalEntity.olt &&
              selectedPon === modalEntity.data.pon,
            onExpand: () =>
              void choosePon(modalEntity.olt, modalEntity.data.pon),
          }
        : modalEntity.kind === "cto"
          ? {
              count: modalEntity.data.cpes,
              label: "CPEs",
              expanded:
                selectedOlt === modalEntity.olt &&
                selectedPon === modalEntity.pon &&
                Object.prototype.hasOwnProperty.call(
                  devicesByCto,
                  modalEntity.data.cto,
                ),
              onExpand: () =>
                void expandCto(
                  modalEntity.olt,
                  modalEntity.pon,
                  modalEntity.data.cto,
                ),
            }
          : undefined
    : undefined;

  const topologyContent = (
    <section className="physical-topology">
      {focusGrouping && (
        <div className="topology-focus-banner" role="status">
          <AlertTriangle size={17} aria-hidden="true" />
          <div>
            <strong>Visão pré-filtrada pelo agrupamento</strong>
            <span className="topology-focus-path">
              {focusGrouping.scope.identifier}
              <b>
                {focusGrouping.affected_cpes.toLocaleString("pt-BR")} CPEs
                potencialmente afetadas
              </b>
            </span>
            <span className="topology-focus-help">
              <i aria-hidden="true">!</i>
              <span>
                Ícones indicam a origem ou os descendentes impactados.
              </span>
            </span>
          </div>
        </div>
      )}
      {focusGrouping && (
        <TopologyImpactSummary
          grouping={focusGrouping}
          devicesByCto={devicesByCto}
        />
      )}
      {error && <p className="physical-error">{error}</p>}

      {topology ? (
        <NetworkExplorerGraph
          topology={topology}
          devicesByCto={devicesByCto}
          selectedOlt={selectedOlt}
          selectedPon={selectedPon}
          selectedCto={selectedCto}
          selectedPath={selectedPath}
          highlightedEntity={modalEntity}
          topologyIssues={
            focusGrouping ? [focusIssue(focusGrouping)] : topologyIssues
          }
          loading={loading}
          onChangeOlt={(olt) => void chooseOlt(olt)}
          onSelectOlt={setModalEntity}
          onSelectPon={setModalEntity}
          onSelectCto={setModalEntity}
          onSelectDevice={(entity) => {
            setModalEntity(entity);
            setSelectedCto(entity.data.cto);
            setSelectedPath(entity.data);
          }}
        />
      ) : (
        <div className="network-map-loading" role="status">
          <span />
          <p>Carregando infraestrutura de rede…</p>
        </div>
      )}

      {modalEntity && (
        <NetworkEntityModal
          entity={modalEntity}
          directChildren={directChildren}
          onClose={() => setModalEntity(null)}
        />
      )}
    </section>
  );

  if (!onClose) return topologyContent;

  return (
    <div
      className="entity-modal-backdrop grouping-topology-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="grouping-topology-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="grouping-topology-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="grouping-topology-title" className="sr-only">
          Infraestrutura afetada pelo agrupamento
        </h2>
        <button
          className="entity-modal-close grouping-topology-close"
          type="button"
          onClick={onClose}
          aria-label="Fechar infraestrutura afetada"
        >
          <X size={19} />
        </button>
        {topologyContent}
      </section>
    </div>
  );
}
