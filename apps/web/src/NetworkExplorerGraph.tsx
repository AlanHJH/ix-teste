import { KeyboardEvent, WheelEvent, useState } from "react";
import { HelpTooltip } from "./HelpTooltip";
import { providerGlossary, TechnicalText } from "./ProviderGlossary";
import type { EquipmentPath, TopologySnapshot } from "./types";
import type { NetworkEntity } from "./NetworkEntityModal";

type Point = { x: number; y: number };
type Positioned<T> = Point & { item: T };
type Olt = TopologySnapshot["olts"][number];
type Pon = TopologySnapshot["pons"][number];
type Cto = TopologySnapshot["ctos"][number];

const number = new Intl.NumberFormat("pt-BR");
const GRAPH_WIDTH = 1_200;
const GRAPH_HEIGHT = 1_100;
const GRAPH_CENTER = { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 };
const NODE_WIDTH = 142;
const NODE_HEIGHT = 46;

function centerOf(point: Point) {
  return { x: point.x + NODE_WIDTH / 2, y: point.y + NODE_HEIGHT / 2 };
}

function positionOnRings<T>(
  items: T[],
  center: Point,
  radii: number[],
  capacityPerRing: number[],
) {
  const positioned: Array<{ item: T; x: number; y: number }> = [];
  let offset = 0;

  radii.forEach((radius, ringIndex) => {
    const remaining = items.length - offset;
    const count = Math.min(remaining, capacityPerRing[ringIndex] ?? remaining);
    if (count <= 0) return;

    for (let index = 0; index < count; index += 1) {
      const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
      positioned.push({
        item: items[offset + index],
        x: center.x + Math.cos(angle) * radius - NODE_WIDTH / 2,
        y: center.y + Math.sin(angle) * radius - NODE_HEIGHT / 2,
      });
    }
    offset += count;
  });

  return positioned;
}

function overlaps(first: Point, second: Point, padding = 24) {
  return (
    first.x < second.x + NODE_WIDTH + padding &&
    first.x + NODE_WIDTH + padding > second.x &&
    first.y < second.y + NODE_HEIGHT + padding &&
    first.y + NODE_HEIGHT + padding > second.y
  );
}

function positionChildrenOutward<T>(
  items: T[],
  parent: Point,
  obstacles: Point[] = [],
) {
  const parentCenter = centerOf(parent);
  const angle = Math.atan2(
    parentCenter.y - GRAPH_CENTER.y,
    parentCenter.x - GRAPH_CENTER.x,
  );
  const columns = Math.min(items.length, 4);
  const tangentAngle = angle + Math.PI / 2;

  const positioned: Positioned<T>[] = [];

  items.forEach((item, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const tangentOffset = (column - (columns - 1) / 2) * 185;
    const forwardDistance = 165 + row * 190;
    const center = {
      x:
        parentCenter.x +
        Math.cos(angle) * forwardDistance +
        Math.cos(tangentAngle) * tangentOffset,
      y:
        parentCenter.y +
        Math.sin(angle) * forwardDistance +
        Math.sin(tangentAngle) * tangentOffset,
    };

    let point = {
      item,
      x: center.x - NODE_WIDTH / 2,
      y: center.y - NODE_HEIGHT / 2,
    };
    let attempts = 0;

    while (
      [...obstacles, ...positioned].some((obstacle) =>
        overlaps(point, obstacle),
      ) &&
      attempts < 14
    ) {
      point = {
        ...point,
        x: point.x + Math.cos(angle) * 180,
        y: point.y + Math.sin(angle) * 180,
      };
      attempts += 1;
    }

    positioned.push(point);
  });

  return positioned;
}

function expandedViewBox(points: Point[]) {
  const left = Math.min(...points.map((point) => point.x)) - 80;
  const right = Math.max(...points.map((point) => point.x + NODE_WIDTH)) + 80;
  const top = Math.min(...points.map((point) => point.y)) - 80;
  const bottom = Math.max(...points.map((point) => point.y + NODE_HEIGHT)) + 80;
  const width = Math.max(GRAPH_WIDTH, right - left);
  const height = Math.max(GRAPH_HEIGHT, bottom - top);

  return `${(left + right - width) / 2} ${(top + bottom - height) / 2} ${width} ${height}`;
}

function GraphNode({
  point,
  tone,
  title,
  detail,
  active = false,
  muted = false,
  collapsedChildren,
  onSelect,
}: {
  point: Point;
  tone: "olt" | "pon" | "cto" | "cpe";
  title: string;
  detail: string;
  active?: boolean;
  muted?: boolean;
  collapsedChildren?: { count: number; label: string };
  onSelect: () => void;
}) {
  function handleKeyDown(event: KeyboardEvent<SVGGElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  }

  return (
    <g
      className={`network-graph-node ${tone} ${active ? "active" : ""} ${muted ? "muted" : ""}`}
      transform={`translate(${point.x} ${point.y})`}
      role="button"
      tabIndex={0}
      aria-label={`${title}: ${detail}${
        collapsedChildren
          ? `. Clique para expandir ${collapsedChildren.count} ${collapsedChildren.label}`
          : ""
      }`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <title>{`${title}: ${detail}. ${
        collapsedChildren
          ? `Clique para expandir ${collapsedChildren.count} ${collapsedChildren.label}.`
          : "Clique para ver os dados deste item."
      }`}</title>
      <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="9" />
      <text x="11" y="19" className="network-graph-node-title">
        {title}
      </text>
      <text x="11" y="35" className="network-graph-node-detail">
        {detail}
      </text>
      {collapsedChildren && (
        <g className="network-graph-node-expand-indicator" aria-hidden="true">
          <circle cx={NODE_WIDTH - 16} cy="14" r="9" />
          <path d={`M${NODE_WIDTH - 19} 12 l3 3 3 -3`} />
        </g>
      )}
    </g>
  );
}

function OltConstellation({
  olt,
  active,
  pons,
  ctos,
  devices,
  selectedPon,
  selectedCto,
  selectedPath,
  highlightedEntity,
  zoom,
  onWheel,
  onSelectOlt,
  onSelectPon,
  onSelectCto,
  onSelectDevice,
}: {
  olt: Olt;
  active: boolean;
  pons: Pon[];
  ctos: Cto[];
  devices: EquipmentPath[];
  selectedPon: string;
  selectedCto: string;
  selectedPath: EquipmentPath | null;
  highlightedEntity: NetworkEntity | null;
  zoom: number;
  onWheel: (event: WheelEvent<SVGSVGElement>) => void;
  onSelectOlt: () => void;
  onSelectPon: (pon: Pon) => void;
  onSelectCto: (cto: Cto) => void;
  onSelectDevice: (device: EquipmentPath) => void;
}) {
  const oltPoint = {
    x: GRAPH_CENTER.x - NODE_WIDTH / 2,
    y: GRAPH_CENTER.y - NODE_HEIGHT / 2,
  };
  const ponNodes = positionOnRings(
    pons,
    GRAPH_CENTER,
    [180, 285, 390, 495],
    [8, 14, 20, 28],
  );
  const selectedPonNode = ponNodes.find(
    (node) => node.item.pon === selectedPon,
  );
  const allCtoNodes = selectedPonNode
    ? positionChildrenOutward(
        ctos,
        selectedPonNode,
        ponNodes.filter((node) => node.item.pon !== selectedPon),
      )
    : [];
  const selectedCtoNode = allCtoNodes.find(
    (node) => node.item.cto === selectedCto,
  );
  const ctoNodes = allCtoNodes;
  const deviceNodes = selectedCtoNode
    ? positionChildrenOutward(devices, selectedCtoNode, [
        ...ponNodes,
        ...ctoNodes.filter((node) => node.item.cto !== selectedCto),
      ])
    : [];
  const branchExpanded = ctoNodes.length > 0 || deviceNodes.length > 0;
  const viewBox = branchExpanded
    ? expandedViewBox([oltPoint, ...ponNodes, ...ctoNodes, ...deviceNodes])
    : `0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`;
  const isFocusedOlt = highlightedEntity?.kind === "olt";
  const isFocusedPon = highlightedEntity?.kind === "pon";
  const isFocusedCto = highlightedEntity?.kind === "cto";
  const isFocusedCpe = highlightedEntity?.kind === "cpe";
  const hasVisualFocus = highlightedEntity !== null;

  function isHighlightedOlt() {
    return (
      highlightedEntity?.kind === "olt" &&
      highlightedEntity.data.olt === olt.olt
    );
  }

  function isHighlightedPon(pon: Pon) {
    if (!highlightedEntity) return true;
    if (isFocusedOlt) return highlightedEntity.data.olt === olt.olt;
    if (highlightedEntity.kind === "pon") {
      return (
        highlightedEntity.olt === olt.olt &&
        highlightedEntity.data.pon === pon.pon
      );
    }
    if (highlightedEntity.kind === "cto") {
      return (
        highlightedEntity.olt === olt.olt && highlightedEntity.pon === pon.pon
      );
    }
    return false;
  }

  function isHighlightedCto(cto: Cto) {
    if (!highlightedEntity) return true;
    if (isFocusedOlt) return highlightedEntity.data.olt === olt.olt;
    if (isFocusedPon) {
      return (
        highlightedEntity.olt === olt.olt &&
        highlightedEntity.data.pon === selectedPon
      );
    }
    if (isFocusedCto) {
      return (
        highlightedEntity.olt === olt.olt &&
        highlightedEntity.data.cto === cto.cto
      );
    }
    return false;
  }

  function isHighlightedDevice(device: EquipmentPath) {
    if (!highlightedEntity) return true;
    if (isFocusedOlt) return highlightedEntity.data.olt === olt.olt;
    if (isFocusedPon) {
      return (
        highlightedEntity.olt === olt.olt &&
        highlightedEntity.data.pon === selectedPon
      );
    }
    if (isFocusedCto) {
      return (
        highlightedEntity.olt === olt.olt &&
        highlightedEntity.data.cto === selectedCto
      );
    }
    return isFocusedCpe && highlightedEntity.data.serial === device.serial;
  }

  return (
    <article className={`olt-constellation ${active ? "active" : ""}`}>
      <header>
        <div>
          <span className="section-label">Constelação óptica</span>
          <h4>{olt.olt}</h4>
          <p>
            {number.format(olt.pons)} PONs · {number.format(olt.ctos)} CTOs ·{" "}
            {number.format(olt.cpes)} CPEs
          </p>
        </div>
        <span
          className={
            active ? "constellation-state active" : "constellation-state"
          }
        >
          {active ? "Em foco" : "PONs visíveis"}
        </span>
      </header>
      <svg
        className={`olt-constellation-canvas ${branchExpanded ? "branch-expanded" : ""}`}
        viewBox={viewBox}
        role="group"
        aria-label={`Topologia radial da ${olt.olt}`}
        onWheel={active ? onWheel : undefined}
      >
        <g
          transform={`translate(${GRAPH_CENTER.x} ${GRAPH_CENTER.y}) scale(${active ? zoom : 1}) translate(${-GRAPH_CENTER.x} ${-GRAPH_CENTER.y})`}
        >
          <g className="network-graph-rings" aria-hidden="true">
            <circle cx={GRAPH_CENTER.x} cy={GRAPH_CENTER.y} r="102" />
            {pons.length > 0 && (
              <circle cx={GRAPH_CENTER.x} cy={GRAPH_CENTER.y} r="495" />
            )}
          </g>
          <g className="network-graph-edges" aria-hidden="true">
            {ponNodes.map((node) => (
              <line
                key={`olt-${node.item.pon}`}
                x1={centerOf(oltPoint).x}
                y1={centerOf(oltPoint).y}
                x2={centerOf(node).x}
                y2={centerOf(node).y}
              />
            ))}
            {selectedPonNode &&
              ctoNodes.map((node) => (
                <line
                  key={`pon-${node.item.cto}`}
                  x1={centerOf(selectedPonNode).x}
                  y1={centerOf(selectedPonNode).y}
                  x2={centerOf(node).x}
                  y2={centerOf(node).y}
                />
              ))}
            {selectedCtoNode &&
              deviceNodes.map((node) => (
                <line
                  key={`cto-${node.item.serial}`}
                  className="drop"
                  x1={centerOf(selectedCtoNode).x}
                  y1={centerOf(selectedCtoNode).y}
                  x2={centerOf(node).x}
                  y2={centerOf(node).y}
                />
              ))}
          </g>
          <g className="network-graph-layer-labels" aria-hidden="true">
            <text x={GRAPH_CENTER.x - 22} y={GRAPH_CENTER.y - 118}>
              OLT
            </text>
            {pons.length > 0 && (
              <text x={GRAPH_CENTER.x - 24} y={GRAPH_CENTER.y - 515}>
                PONs
              </text>
            )}
          </g>
          <GraphNode
            point={oltPoint}
            tone="olt"
            title={olt.olt}
            detail={`${number.format(olt.cpes)} CPEs`}
            active={active}
            muted={hasVisualFocus && !isHighlightedOlt()}
            onSelect={onSelectOlt}
          />
          {ponNodes.map((node) => (
            <GraphNode
              key={node.item.pon}
              point={node}
              tone="pon"
              title={`PON ${node.item.pon}`}
              detail={`${number.format(node.item.ctos)} CTOs`}
              active={node.item.pon === selectedPon}
              muted={hasVisualFocus && !isHighlightedPon(node.item)}
              collapsedChildren={
                node.item.pon === selectedPon
                  ? undefined
                  : { count: node.item.ctos, label: "CTOs" }
              }
              onSelect={() => onSelectPon(node.item)}
            />
          ))}
          {ctoNodes.map((node) => (
            <GraphNode
              key={node.item.cto}
              point={node}
              tone="cto"
              title={node.item.cto}
              detail={`${number.format(node.item.cpes)} CPEs`}
              active={node.item.cto === selectedCto}
              muted={hasVisualFocus && !isHighlightedCto(node.item)}
              collapsedChildren={
                node.item.cto === selectedCto
                  ? undefined
                  : { count: node.item.cpes, label: "CPEs" }
              }
              onSelect={() => onSelectCto(node.item)}
            />
          ))}
          {deviceNodes.map((node) => (
            <GraphNode
              key={node.item.serial}
              point={node}
              tone="cpe"
              title={node.item.customer_id}
              detail={node.item.logical_drop_id ?? node.item.serial}
              active={node.item.serial === selectedPath?.serial}
              muted={hasVisualFocus && !isHighlightedDevice(node.item)}
              onSelect={() => onSelectDevice(node.item)}
            />
          ))}
        </g>
      </svg>
    </article>
  );
}

export function NetworkExplorerGraph({
  topology,
  devices,
  ponsByOlt,
  selectedOlt,
  selectedPon,
  selectedCto,
  selectedPath,
  highlightedEntity,
  onSelectOlt,
  onSelectPon,
  onSelectCto,
  onSelectDevice,
}: {
  topology: TopologySnapshot;
  devices: EquipmentPath[];
  ponsByOlt: Record<string, TopologySnapshot["pons"]>;
  selectedOlt: string;
  selectedPon: string;
  selectedCto: string;
  selectedPath: EquipmentPath | null;
  highlightedEntity: NetworkEntity | null;
  onSelectOlt: (olt: NetworkEntity & { kind: "olt" }) => void;
  onSelectPon: (pon: NetworkEntity & { kind: "pon" }) => void;
  onSelectCto: (cto: NetworkEntity & { kind: "cto" }) => void;
  onSelectDevice: (device: NetworkEntity & { kind: "cpe" }) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const focusedOlt = selectedOlt || topology.olts[0]?.olt || "";
  const branchMatchesSelection = topology.selected.olt === focusedOlt;
  const selectedPons = branchMatchesSelection ? topology.pons : [];
  const ctos =
    branchMatchesSelection && topology.selected.pon === selectedPon
      ? topology.ctos
      : [];
  const branchDevices = ctos.some((cto) => cto.cto === selectedCto)
    ? devices
    : [];

  function adjustZoom(change: number) {
    setZoom((current) => Math.min(2.2, Math.max(0.7, current + change)));
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    adjustZoom(event.deltaY < 0 ? 0.12 : -0.12);
  }

  return (
    <section
      className="network-graph-panel"
      aria-labelledby="network-graph-title"
    >
      <header className="network-graph-heading">
        <div>
          <span className="section-label">
            Topologia por OLT
            <HelpTooltip
              term="OLT"
              description={providerGlossary.olt.description}
            />
          </span>
          <h3 id="network-graph-title">Quatro ramos, sem cruzar as redes.</h3>
          <p>
            <TechnicalText text="Cada painel já abre com as PONs da OLT. Selecione uma PON para expandir suas CTOs e CPEs sem misturar equipamentos de outra OLT." />
          </p>
        </div>
        <div
          className="network-graph-controls"
          aria-label="Zoom da OLT em foco"
        >
          <button
            type="button"
            aria-label="Diminuir zoom da OLT em foco"
            title="Diminui o zoom da constelação óptica em foco."
            onClick={() => adjustZoom(-0.2)}
          >
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            aria-label="Aumentar zoom da OLT em foco"
            title="Aumenta o zoom da constelação óptica em foco."
            onClick={() => adjustZoom(0.2)}
          >
            +
          </button>
          <button
            type="button"
            className="network-graph-reset"
            title="Restaura o zoom para a visão completa da OLT em foco."
            onClick={() => setZoom(1)}
          >
            Ver completo
          </button>
        </div>
      </header>

      <div className="network-graph-legend" aria-label="Legenda do grafo">
        <span className="olt">
          OLT{" "}
          <HelpTooltip
            term="OLT"
            description={providerGlossary.olt.description}
          />
        </span>
        <span className="pon">
          PON{" "}
          <HelpTooltip
            term="PON"
            description={providerGlossary.pon.description}
          />
        </span>
        <span className="cto">
          CTO{" "}
          <HelpTooltip
            term="CTO"
            description={providerGlossary.cto.description}
          />
        </span>
        <span className="cpe">
          CPE / cliente{" "}
          <HelpTooltip
            term="CPE"
            description={providerGlossary.cpe.description}
          />
        </span>
        <small>
          CTO → CPE: drop lógico estimado{" "}
          <HelpTooltip
            term="Drop lógico"
            description={providerGlossary.drop.description}
          />
        </small>
      </div>

      <div className="olt-constellations" aria-label="Constelações por OLT">
        {topology.olts.map((olt) => {
          const active = olt.olt === focusedOlt;
          const cardPons = ponsByOlt[olt.olt] ?? (active ? selectedPons : []);
          return (
            <OltConstellation
              key={olt.olt}
              olt={olt}
              active={active}
              pons={cardPons}
              ctos={active ? ctos : []}
              devices={active ? branchDevices : []}
              selectedPon={active ? selectedPon : ""}
              selectedCto={active ? selectedCto : ""}
              selectedPath={active ? selectedPath : null}
              highlightedEntity={highlightedEntity}
              zoom={zoom}
              onWheel={handleWheel}
              onSelectOlt={() => onSelectOlt({ kind: "olt", data: olt })}
              onSelectPon={(pon) =>
                onSelectPon({ kind: "pon", olt: olt.olt, data: pon })
              }
              onSelectCto={(cto) =>
                onSelectCto({
                  kind: "cto",
                  olt: olt.olt,
                  pon: selectedPon,
                  data: cto,
                })
              }
              onSelectDevice={(device) =>
                onSelectDevice({ kind: "cpe", data: device })
              }
            />
          );
        })}
      </div>
      <p className="network-graph-footnote">
        Todas as OLTs já exibem suas PONs. A OLT em foco expande CTOs e CPEs
        para manter legíveis as {number.format(topology.totals.cpes)} CPEs
        ativas.
      </p>
    </section>
  );
}
