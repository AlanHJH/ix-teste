import {
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { RefreshCw } from "lucide-react";
import { HelpTooltip } from "./HelpTooltip";
import { providerGlossary, TechnicalText } from "./ProviderGlossary";
import type { EquipmentPath, TopologyIssue, TopologySnapshot } from "./types";
import type { NetworkEntity } from "./NetworkEntityModal";

type Point = { x: number; y: number };
type Positioned<T> = Point & { item: T };
type ViewBox = Point & { width: number; height: number };
type Olt = TopologySnapshot["olts"][number];
type Pon = TopologySnapshot["pons"][number];
type Cto = TopologySnapshot["ctos"][number];

const number = new Intl.NumberFormat("pt-BR");
const GRAPH_WIDTH = 1_200;
const GRAPH_HEIGHT = 1_100;
const GRAPH_CENTER = { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 };
const NODE_WIDTH = 142;
const NODE_HEIGHT = 46;
const NODE_TEXT_WIDTH = NODE_WIDTH - 22;

function textLengthForNode(
  value: string,
  fontSize: number,
  availableWidth = NODE_TEXT_WIDTH,
) {
  const estimatedWidth = value.length * fontSize * 0.68;
  return estimatedWidth > availableWidth ? availableWidth : undefined;
}

type GraphNodeKind = "olt" | "pon" | "cto" | "cpe";
type GraphNodeIssue = {
  relation: "origin" | "descendant";
  severity: TopologyIssue["severity"];
  confidence: number;
  title: string;
  source?: TopologyIssue["source"];
};

const severityRank: Record<TopologyIssue["severity"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function normalized(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function centerOf(point: Point) {
  return { x: point.x + NODE_WIDTH / 2, y: point.y + NODE_HEIGHT / 2 };
}

function issueRelationLabel(issue: GraphNodeIssue) {
  if (issue.source === "measurements" && issue.relation === "descendant") {
    return "Offline provável por falha histórica no pai";
  }
  if (issue.source === "measurements") {
    return "Falha histórica de comunicação neste nó";
  }
  return issue.relation === "origin"
    ? "Problema indicativo neste nó"
    : "Impacto descendente indicado";
}

function positionOnRings<T>(
  items: T[],
  center: Point,
  radii: number[],
  capacityPerRing: number[],
) {
  const positioned: Positioned<T>[] = [];
  let offset = 0;

  radii.forEach((radius, ringIndex) => {
    const remaining = items.length - offset;
    const count = Math.min(remaining, capacityPerRing[ringIndex] ?? remaining);
    if (count <= 0) return;

    for (let index = 0; index < count; index += 1) {
      const phase = ringIndex % 2 === 0 ? 0 : Math.PI / count;
      const angle = -Math.PI / 2 + phase + (index / count) * Math.PI * 2;
      let nodeRadius = radius;
      let point: Positioned<T> = {
        item: items[offset + index],
        x: center.x + Math.cos(angle) * nodeRadius - NODE_WIDTH / 2,
        y: center.y + Math.sin(angle) * nodeRadius - NODE_HEIGHT / 2,
      };

      while (positioned.some((other) => overlaps(point, other))) {
        nodeRadius += 42;
        point = {
          ...point,
          x: center.x + Math.cos(angle) * nodeRadius - NODE_WIDTH / 2,
          y: center.y + Math.sin(angle) * nodeRadius - NODE_HEIGHT / 2,
        };
      }

      positioned.push(point);
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
    const forwardDistance = 210 + row * 210;
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
    while (
      [...obstacles, ...positioned].some((obstacle) =>
        overlaps(point, obstacle),
      )
    ) {
      point = {
        ...point,
        x: point.x + Math.cos(angle) * 190,
        y: point.y + Math.sin(angle) * 190,
      };
    }

    positioned.push(point);
  });

  return positioned;
}

function expandedViewBox(points: Point[]): ViewBox {
  const left = Math.min(...points.map((point) => point.x)) - 80;
  const right = Math.max(...points.map((point) => point.x + NODE_WIDTH)) + 80;
  const top = Math.min(...points.map((point) => point.y)) - 80;
  const bottom = Math.max(...points.map((point) => point.y + NODE_HEIGHT)) + 80;
  const width = Math.max(GRAPH_WIDTH, right - left);
  const height = Math.max(GRAPH_HEIGHT, bottom - top);

  return {
    x: (left + right - width) / 2,
    y: (top + bottom - height) / 2,
    width,
    height,
  };
}

function GraphNode({
  point,
  tone,
  title,
  detail,
  active = false,
  muted = false,
  issue,
  collapsedChildren,
  onSelect,
}: {
  point: Point;
  tone: "olt" | "pon" | "cto" | "cpe";
  title: string;
  detail: string;
  active?: boolean;
  muted?: boolean;
  issue?: GraphNodeIssue;
  collapsedChildren?: { count: number; label: string };
  onSelect: () => void;
}) {
  const textWidth =
    collapsedChildren || issue ? NODE_TEXT_WIDTH - 34 : NODE_TEXT_WIDTH;

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
        issue
          ? `. ${issueRelationLabel(issue)}: ${issue.title}, confiança de ${Math.round(issue.confidence * 100)}%`
          : ""
      }${
        collapsedChildren
          ? `. Clique para expandir ${collapsedChildren.count} ${collapsedChildren.label}`
          : ""
      }`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <title>{`${title}: ${detail}. ${
        issue
          ? `${issueRelationLabel(issue)}: ${issue.title}, confiança de ${Math.round(issue.confidence * 100)}%.`
          : ""
      } ${
        collapsedChildren
          ? `Clique para expandir ${collapsedChildren.count} ${collapsedChildren.label}.`
          : "Clique para ver os dados deste item."
      }`}</title>
      <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="9" />
      <text
        x="11"
        y="19"
        className="network-graph-node-title"
        textLength={textLengthForNode(title, 17, textWidth)}
        lengthAdjust="spacingAndGlyphs"
      >
        {title}
      </text>
      <text
        x="11"
        y="35"
        className="network-graph-node-detail"
        textLength={textLengthForNode(detail, 13, textWidth)}
        lengthAdjust="spacingAndGlyphs"
      >
        {detail}
      </text>
      {issue && (
        <g
          className={`network-graph-node-issue ${issue.relation} ${issue.severity}`}
          aria-hidden="true"
        >
          <circle cx={NODE_WIDTH - 16} cy={NODE_HEIGHT - 14} r="8" />
          <text x={NODE_WIDTH - 16} y={NODE_HEIGHT - 11}>
            !
          </text>
        </g>
      )}
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
  pons,
  ctos,
  devicesByCto,
  selectedPon,
  selectedCto,
  selectedPath,
  highlightedEntity,
  topologyIssues,
  zoom,
  resetToken,
  onWheel,
  onSelectOlt,
  onSelectPon,
  onSelectCto,
  onSelectDevice,
}: {
  olt: Olt;
  pons: Pon[];
  ctos: Cto[];
  devicesByCto: Record<string, EquipmentPath[]>;
  selectedPon: string;
  selectedCto: string;
  selectedPath: EquipmentPath | null;
  highlightedEntity: NetworkEntity | null;
  topologyIssues: TopologyIssue[];
  zoom: number;
  resetToken: number;
  onWheel: (event: WheelEvent<SVGSVGElement>) => void;
  onSelectOlt: () => void;
  onSelectPon: (pon: Pon) => void;
  onSelectCto: (cto: Cto) => void;
  onSelectDevice: (device: EquipmentPath) => void;
}) {
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    pan: Point;
  } | null>(null);

  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setDragging(false);
    dragStart.current = null;
  }, [olt.olt, resetToken]);

  const oltPoint = {
    x: GRAPH_CENTER.x - NODE_WIDTH / 2,
    y: GRAPH_CENTER.y - NODE_HEIGHT / 2,
  };
  const ponNodes = positionOnRings(
    pons,
    GRAPH_CENTER,
    [220, 440, 660, 880],
    [7, 14, 21, 28],
  );
  const selectedPonNode = ponNodes.find(
    (node) => node.item.pon === selectedPon,
  );
  const ctoNodes = selectedPonNode
    ? positionChildrenOutward(ctos, selectedPonNode, [oltPoint, ...ponNodes])
    : [];
  const occupiedPoints: Point[] = [oltPoint, ...ponNodes, ...ctoNodes];
  const deviceBranches: Array<{
    parent: Positioned<Cto>;
    nodes: Positioned<EquipmentPath>[];
  }> = [];

  ctoNodes.forEach((ctoNode) => {
    const devices = devicesByCto[ctoNode.item.cto];
    if (!devices) return;

    const nodes = positionChildrenOutward(devices, ctoNode, occupiedPoints);
    deviceBranches.push({ parent: ctoNode, nodes });
    occupiedPoints.push(...nodes);
  });

  const expandedCtos = new Set(Object.keys(devicesByCto));
  const deviceNodes = deviceBranches.flatMap((branch) => branch.nodes);
  const branchExpanded = ctoNodes.length > 0 || deviceNodes.length > 0;
  const viewBox = expandedViewBox([
    oltPoint,
    ...ponNodes,
    ...ctoNodes,
    ...deviceNodes,
  ]);
  const outerPonRadius = Math.max(
    102,
    ...ponNodes.map((node) => {
      const center = centerOf(node);
      return Math.hypot(center.x - GRAPH_CENTER.x, center.y - GRAPH_CENTER.y);
    }),
  );
  const isFocusedOlt = highlightedEntity?.kind === "olt";
  const isFocusedPon = highlightedEntity?.kind === "pon";
  const isFocusedCto = highlightedEntity?.kind === "cto";
  const isFocusedCpe = highlightedEntity?.kind === "cpe";
  const hasVisualFocus = highlightedEntity !== null;

  function issueForNode(
    kind: GraphNodeKind,
    location: {
      olt: string;
      pon?: string;
      cto?: string;
      serial?: string;
      customerId?: string;
      softwareVersion?: string;
      equipment?: string;
      city?: string;
      neighborhood?: string;
    },
  ): GraphNodeIssue | undefined {
    const candidates = topologyIssues.flatMap((issue) => {
      const scope = issue.scope;
      const scopeType = scope.type;
      const isSpecificEquipment = [
        "equipment",
        "customer",
        "firmware",
      ].includes(scopeType);
      const identifier = normalized(scope.identifier);

      if (scope.olt && normalized(scope.olt) !== normalized(location.olt)) {
        return [];
      }
      if (scope.pon && normalized(scope.pon) !== normalized(location.pon)) {
        return [];
      }
      if (scope.cto && normalized(scope.cto) !== normalized(location.cto)) {
        return [];
      }
      if (scope.pon && !location.pon) return [];
      if (scope.cto && !location.cto) return [];

      if (
        scopeType === "olt" &&
        identifier &&
        normalized(location.olt) !== identifier
      ) {
        return [];
      }
      if (
        scopeType === "pon" &&
        identifier &&
        normalized(location.pon) !== identifier &&
        normalized(`${location.olt} · PON ${location.pon}`) !== identifier
      ) {
        return [];
      }
      if (
        scopeType === "cto" &&
        identifier &&
        normalized(location.cto) !== identifier &&
        normalized(
          `${location.olt} · PON ${location.pon} · ${location.cto}`,
        ) !== identifier
      ) {
        return [];
      }

      if (isSpecificEquipment) {
        if (kind !== "cpe") return [];
        const matchesIdentifier =
          (scopeType === "equipment" &&
            [location.serial, location.customerId, location.equipment]
              .map(normalized)
              .some(
                (value) =>
                  value === identifier ||
                  Boolean(value && identifier && value.includes(identifier)),
              )) ||
          (scopeType === "customer" &&
            normalized(location.customerId) === identifier) ||
          (scopeType === "firmware" &&
            normalized(location.softwareVersion) === identifier);
        if (!matchesIdentifier) return [];
      } else if (scopeType === "region") {
        const region = normalized(identifier);
        if (
          ![location.city, location.neighborhood]
            .map(normalized)
            .some((value) => value === region || value.includes(region))
        ) {
          return [];
        }
      } else if (
        !scope.olt &&
        !scope.pon &&
        !scope.cto &&
        !["network", "park", "region"].includes(scopeType)
      ) {
        return [];
      }

      const isOrigin =
        (scope.cto && kind === "cto") ||
        (scope.pon && kind === "pon") ||
        (scope.olt && kind === "olt") ||
        (isSpecificEquipment && kind === "cpe") ||
        (!scope.olt &&
          !scope.pon &&
          !scope.cto &&
          ["network", "park", "region"].includes(scopeType) &&
          kind === "olt");

      return [
        {
          issue,
          relation: isOrigin ? ("origin" as const) : ("descendant" as const),
        },
      ];
    });

    return candidates
      .sort(
        (first, second) =>
          Number(second.relation === "origin") -
            Number(first.relation === "origin") ||
          Number(
            second.relation === "descendant" &&
              second.issue.source === "measurements",
          ) -
            Number(
              first.relation === "descendant" &&
                first.issue.source === "measurements",
            ) ||
          severityRank[second.issue.severity] -
            severityRank[first.issue.severity] ||
          second.issue.confidence - first.issue.confidence,
      )
      .map(({ issue, relation }) => ({
        relation,
        severity: issue.severity,
        confidence: issue.confidence,
        title: issue.title,
        source: issue.source,
      }))[0];
  }

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
    if (isFocusedCto)
      return (
        highlightedEntity.olt === olt.olt &&
        highlightedEntity.data.cto === device.cto
      );
    return isFocusedCpe && highlightedEntity.data.serial === device.serial;
  }

  function beginPan(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      pan,
    };
    setDragging(true);
  }

  function movePan(event: ReactPointerEvent<SVGSVGElement>) {
    const start = dragStart.current;
    if (!start || start.pointerId !== event.pointerId) return;

    const scaleX = viewBox.width / event.currentTarget.clientWidth;
    const scaleY = viewBox.height / event.currentTarget.clientHeight;
    setPan({
      x: start.pan.x + (event.clientX - start.clientX) * scaleX,
      y: start.pan.y + (event.clientY - start.clientY) * scaleY,
    });
  }

  function endPan(event: ReactPointerEvent<SVGSVGElement>) {
    if (dragStart.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStart.current = null;
    setDragging(false);
  }

  return (
    <article className="olt-constellation">
      <svg
        className={`olt-constellation-canvas ${branchExpanded ? "branch-expanded" : ""} ${dragging ? "dragging" : ""}`}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        role="group"
        aria-label={`Topologia navegável da ${olt.olt}`}
        onWheel={onWheel}
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <g
          transform={`translate(${pan.x} ${pan.y}) translate(${GRAPH_CENTER.x} ${GRAPH_CENTER.y}) scale(${zoom}) translate(${-GRAPH_CENTER.x} ${-GRAPH_CENTER.y})`}
        >
          <g className="network-graph-rings" aria-hidden="true">
            <circle cx={GRAPH_CENTER.x} cy={GRAPH_CENTER.y} r="102" />
            {pons.length > 0 && (
              <circle
                cx={GRAPH_CENTER.x}
                cy={GRAPH_CENTER.y}
                r={outerPonRadius}
              />
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
            {deviceBranches.flatMap((branch) =>
              branch.nodes.map((node) => (
                <line
                  key={`cto-${node.item.serial}`}
                  className="drop"
                  x1={centerOf(branch.parent).x}
                  y1={centerOf(branch.parent).y}
                  x2={centerOf(node).x}
                  y2={centerOf(node).y}
                />
              )),
            )}
          </g>
          <g className="network-graph-layer-labels" aria-hidden="true">
            <text x={GRAPH_CENTER.x - 22} y={GRAPH_CENTER.y - 118}>
              OLT
            </text>
            {pons.length > 0 && (
              <text
                x={GRAPH_CENTER.x - 24}
                y={GRAPH_CENTER.y - outerPonRadius - 20}
              >
                PONs
              </text>
            )}
          </g>
          <GraphNode
            point={oltPoint}
            tone="olt"
            title={olt.olt}
            detail={`${number.format(olt.cpes)} CPEs`}
            active
            issue={issueForNode("olt", { olt: olt.olt })}
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
              issue={issueForNode("pon", {
                olt: olt.olt,
                pon: node.item.pon,
              })}
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
              detail={`PON ${selectedPon} · ${number.format(node.item.cpes)} CPEs`}
              active={node.item.cto === selectedCto}
              issue={issueForNode("cto", {
                olt: olt.olt,
                pon: selectedPon,
                cto: node.item.cto,
                city: node.item.city,
                neighborhood: node.item.neighborhood,
              })}
              muted={hasVisualFocus && !isHighlightedCto(node.item)}
              collapsedChildren={
                expandedCtos.has(node.item.cto)
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
              issue={issueForNode("cpe", {
                olt: olt.olt,
                pon: node.item.pon,
                cto: node.item.cto,
                serial: node.item.serial,
                customerId: node.item.customer_id,
                softwareVersion: node.item.software_version,
                equipment: `${node.item.vendor} ${node.item.model} ${node.item.hw_revision}`,
                city: node.item.city,
                neighborhood: node.item.neighborhood,
              })}
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
  devicesByCto,
  selectedOlt,
  selectedPon,
  selectedCto,
  selectedPath,
  highlightedEntity,
  topologyIssues,
  loading,
  refreshing,
  focusMode = false,
  onRefresh,
  onChangeOlt,
  onSelectOlt,
  onSelectPon,
  onSelectCto,
  onSelectDevice,
}: {
  topology: TopologySnapshot;
  devicesByCto: Record<string, EquipmentPath[]>;
  selectedOlt: string;
  selectedPon: string;
  selectedCto: string;
  selectedPath: EquipmentPath | null;
  highlightedEntity: NetworkEntity | null;
  topologyIssues: TopologyIssue[];
  loading: boolean;
  refreshing: boolean;
  focusMode?: boolean;
  onRefresh: () => void;
  onChangeOlt: (olt: string) => void;
  onSelectOlt: (olt: NetworkEntity & { kind: "olt" }) => void;
  onSelectPon: (pon: NetworkEntity & { kind: "pon" }) => void;
  onSelectCto: (cto: NetworkEntity & { kind: "cto" }) => void;
  onSelectDevice: (device: NetworkEntity & { kind: "cpe" }) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [resetToken, setResetToken] = useState(0);
  const focusedOlt = selectedOlt || topology.olts[0]?.olt || "";
  const olt = topology.olts.find((item) => item.olt === focusedOlt);
  const branchMatchesSelection = topology.selected.olt === focusedOlt;
  const pons = branchMatchesSelection ? topology.pons : [];
  const ctos =
    branchMatchesSelection && topology.selected.pon === selectedPon
      ? topology.ctos
      : [];

  useEffect(() => {
    setZoom(1);
    setResetToken((current) => current + 1);
  }, [focusedOlt]);

  function adjustZoom(change: number) {
    setZoom((current) => Math.min(2.4, Math.max(0.55, current + change)));
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    adjustZoom(event.deltaY < 0 ? 0.12 : -0.12);
  }

  function resetView() {
    setZoom(1);
    setResetToken((current) => current + 1);
  }

  return (
    <section
      className={`network-graph-panel ${loading ? "is-loading" : ""} ${focusMode ? "is-focus-mode" : ""}`}
      aria-labelledby="network-graph-title"
    >
      <header className="network-graph-heading">
        <div>
          <span className="section-label">
            {focusMode ? "NOC · Topologia afetada" : "Mapa de entidades"}
          </span>
          <h1 id="network-graph-title">
            {focusMode ? "Mapa da infraestrutura" : "Infraestrutura de rede"}
          </h1>
          <p>
            {focusMode
              ? "Clique nos nós para abrir os dados técnicos e expandir somente a camada necessária."
              : "Selecione uma OLT, arraste o mapa para navegar e clique nos equipamentos para ver detalhes ou abrir a próxima camada."}
          </p>
        </div>
        <div className="network-graph-actions">
          <label className="network-olt-selector">
            <span>OLT exibida</span>
            <select
              value={focusedOlt}
              onChange={(event) => onChangeOlt(event.target.value)}
              disabled={loading}
            >
              {topology.olts.map((item) => (
                <option key={item.olt} value={item.olt}>
                  {item.olt} · {number.format(item.pons)} PONs ·{" "}
                  {number.format(item.cpes)} CPEs
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="network-graph-refresh"
            onClick={onRefresh}
            disabled={loading || refreshing}
            aria-label="Atualizar dados da infraestrutura"
            title="Reconsultar topologia, medições e problemas indicados"
          >
            <RefreshCw size={14} className={refreshing ? "spin" : undefined} />
            {refreshing ? "Atualizando…" : "Atualizar dados"}
          </button>
          <div
            className="network-graph-controls"
            aria-label="Controles do mapa"
          >
            <button
              type="button"
              aria-label="Diminuir zoom"
              title="Diminui o zoom do mapa."
              onClick={() => adjustZoom(-0.2)}
            >
              −
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              aria-label="Aumentar zoom"
              title="Aumenta o zoom do mapa."
              onClick={() => adjustZoom(0.2)}
            >
              +
            </button>
            <button
              type="button"
              className="network-graph-reset"
              title="Centraliza o mapa e restaura o zoom."
              onClick={resetView}
            >
              Centralizar
            </button>
          </div>
        </div>
      </header>

      <div className="network-graph-meta">
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
            CTO → CPE: vínculo de inventário; drop físico não informado{" "}
            <HelpTooltip
              term="Drop físico"
              description={`${providerGlossary.drop.description} O ID físico de campo não foi fornecido neste dataset.`}
            />
          </small>
          {topologyIssues.length > 0 && (
            <small className="network-graph-issue-legend">
              <b aria-hidden="true">!</b> Problema indicativo; descendentes
              podem estar offline
            </small>
          )}
        </div>
        {olt && (
          <p className="network-graph-summary">
            <strong>
              <TechnicalText text={olt.olt} />
            </strong>
            <span>
              <TechnicalText text={`${number.format(olt.pons)} PONs`} />
            </span>
            <span>
              <TechnicalText text={`${number.format(olt.ctos)} CTOs`} />
            </span>
            <span>
              <TechnicalText text={`${number.format(olt.cpes)} CPEs ativas`} />
            </span>
          </p>
        )}
      </div>

      {olt && (
        <div className="olt-constellations" aria-live="polite">
          <OltConstellation
            key={olt.olt}
            olt={olt}
            pons={pons}
            ctos={ctos}
            devicesByCto={devicesByCto}
            selectedPon={selectedPon}
            selectedCto={selectedCto}
            selectedPath={selectedPath}
            highlightedEntity={highlightedEntity}
            topologyIssues={topologyIssues}
            zoom={zoom}
            resetToken={resetToken}
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
        </div>
      )}
    </section>
  );
}
