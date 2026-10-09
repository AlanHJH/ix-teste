import {
  CSSProperties,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CircleDollarSign,
  Clock3,
  GripVertical,
  Gauge,
  Check,
  Pencil,
  RefreshCw,
  Send,
  Server,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "./api";
import {
  BarWidget,
  formulaMetricValue,
  MapWidget,
  MultiSeriesWidget,
  PieWidget,
  TableWidget,
  TopologyWidget,
} from "./DashboardRichWidgets";
import { DashboardDetailModal } from "./DashboardDetailModal";
import type { DashboardDrilldown } from "./DashboardDetailModal";
import { InventoryFilterSelect } from "./InventoryFilterSelect";
import { OfflineClientsPanel } from "./OfflineClientsPanel";
import type {
  DashboardBinding,
  DashboardComposition,
  DashboardDetail,
  DashboardSummary,
  DashboardRuntimeData,
  DashboardWidget,
  InventoryFilter,
  OfflineAlertPage,
  Overview,
} from "./types";

const number = new Intl.NumberFormat("pt-BR");
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const defaultObjective =
  "Quero uma visão executiva diária da saúde da rede, destacando alertas, clientes afetados e a evolução dos chamados.";

const suggestions = [
  "Priorize incidentes críticos e a fila do NOC",
  "Mostre a pressão no suporte e clientes reincidentes",
  "Crie uma visão executiva curta para a diretoria",
  "Monte uma visão exploratória com gráficos, topologia e tabelas",
];

const widgetSuggestions = [
  "Dê mais destaque a este bloco",
  "Troque este bloco por uma métrica mais útil",
  "Deixe este bloco mais compacto e direto",
  "Troque por tabela, gráfico ou mapa com drill-down",
];

type DashboardEditor =
  | { scope: "create"; widgetId: null }
  | { scope: "dashboard"; widgetId: null }
  | { scope: "widget"; widgetId: string };

type DynamicDashboardProps = {
  initialOverview: Overview;
  userId: string;
  onOpenOfflineDiagnosis: (customerId: string) => void;
  fallback: ReactNode;
};

function activeDashboardStorageKey(userId: string) {
  return `ondaluz.dashboard.${userId}.active.v1`;
}

function storageKey(userId: string, dashboardId: string) {
  return `ondaluz.dashboard.${userId}.${dashboardId}.v1`;
}

function defaultWidgetColumns(widget: Pick<DashboardWidget, "size">) {
  if (widget.size === "compact") return 8;
  if (widget.size === "half") return 12;
  return 24;
}

function normalizeComposition(
  composition: DashboardComposition,
): DashboardComposition {
  return {
    ...composition,
    widgets: composition.widgets.map((widget) => ({
      ...widget,
      columns:
        Number.isInteger(widget.columns) &&
        widget.columns >= 4 &&
        widget.columns <= 24
          ? widget.columns
          : defaultWidgetColumns(widget),
    })),
  };
}

function discoveredResourceCount(composition: DashboardComposition) {
  const discovery =
    composition.discovery as DashboardComposition["discovery"] & {
      toolCount?: number;
    };
  return discovery.resourceCount ?? discovery.toolCount ?? 0;
}

function periodStart(days: string) {
  if (days === "all") return "";
  const date = new Date();
  date.setDate(date.getDate() - Number(days));
  return date.toISOString().slice(0, 10);
}

function loadSavedPlan(
  userId: string,
  dashboardId: string,
): DashboardComposition | null {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(storageKey(userId, dashboardId)) ?? "null",
    ) as DashboardComposition | null;
    return parsed?.version === "1.0" ? normalizeComposition(parsed) : null;
  } catch {
    return null;
  }
}

function savePlan(
  userId: string,
  dashboardId: string,
  plan: DashboardComposition,
) {
  try {
    window.localStorage.setItem(
      storageKey(userId, dashboardId),
      JSON.stringify(plan),
    );
  } catch {
    // A composição continua disponível em memória se o navegador bloquear storage.
  }
}

function emptyRuntimeData(initialOverview: Overview): DashboardRuntimeData {
  return {
    overview: initialOverview,
    activeIncidents: {
      data: [],
      page: 1,
      pageSize: 100,
      totalItems: 0,
      totalPages: 0,
    },
    nocQueue: {
      data: [],
      page: 1,
      pageSize: 100,
      totalItems: 0,
      totalPages: 0,
      meta: { summary: { received: 0, inProgress: 0 } },
    },
    topology: {
      totals: { cpes: 0, olts: 0, pons: 0, ctos: 0 },
      olts: [],
      pons: [],
      ctos: [],
      selected: { olt: null, pon: null },
      limitations: {
        hasCableIds: false,
        hasDropIds: false,
        hasLogicalDropIds: false,
        message: "",
      },
    },
    inventory: {
      data: [],
      page: 1,
      pageSize: 100,
      totalItems: 0,
      totalPages: 0,
    },
    telemetry: {
      data: [],
      page: 1,
      pageSize: 15,
      totalItems: 0,
      totalPages: 0,
    },
    diagnostics: {
      data: [],
      page: 1,
      pageSize: 15,
      totalItems: 0,
      totalPages: 0,
      meta: {
        summary: {
          total: 0,
          completed: 0,
          errors: 0,
          avg_download_mbps: null,
          avg_upload_mbps: null,
        },
        filters: { states: [], requested_by: [] },
      },
    },
    fetchedAt: new Date().toISOString(),
  };
}

function runtimeNeeds(widgets: DashboardWidget[]) {
  const bindings = widgets.flatMap((widget) => [
    widget.binding,
    ...(widget.config?.formula?.operands ?? []),
  ]);
  const has = (prefix: string) =>
    bindings.some((binding) => binding.startsWith(prefix));
  return {
    overview:
      has("overview.") ||
      widgets.some((widget) =>
        ["timeseries", "bar", "pie", "multiseries", "narrative"].includes(
          widget.kind,
        ),
      ),
    activeIncidents: has("operations.activeIncidents"),
    nocQueue: has("operations.nocQueue"),
    topology:
      has("network.topology") ||
      widgets.some(
        (widget) => widget.kind === "topology" || widget.kind === "map",
      ),
    inventory: has("inventory."),
    telemetry: has("telemetry."),
    diagnostics: has("diagnostics."),
  };
}

function settledValue<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
  label: string,
  warnings: string[],
) {
  if (result.status === "fulfilled") return result.value;
  warnings.push(label);
  return fallback;
}

function resolveMetricBinding(widget: DashboardWidget): DashboardBinding {
  const label = `${widget.title} ${widget.description}`.toLocaleLowerCase(
    "pt-BR",
  );
  if (/\bolts?\b/.test(label)) return "overview.oltCount";
  if (/\bpons?\b|porta[s]? pon/.test(label)) return "overview.ponCount";
  return widget.binding;
}

function MetricIcon({ binding }: { binding: DashboardBinding }) {
  if (binding === "overview.activeCpes") return <Activity size={19} />;
  if (binding === "overview.oltCount") return <Server size={19} />;
  if (binding === "overview.ponCount") return <Gauge size={19} />;
  if (binding === "overview.estimatedImpact") {
    return <CircleDollarSign size={19} />;
  }
  if (binding === "overview.ticketGrowthPct") return <Gauge size={19} />;
  return <Users size={19} />;
}

function metricValue(binding: DashboardBinding, overview: Overview) {
  switch (binding) {
    case "overview.activeCpes":
      return number.format(overview.kpis.activeCpes);
    case "overview.oltCount":
      return number.format(overview.kpis.oltCount);
    case "overview.ponCount":
      return number.format(overview.kpis.ponCount);
    case "overview.affectedCpes":
      return number.format(overview.kpis.affectedCpes);
    case "overview.repeatCustomers":
      return number.format(overview.kpis.repeatCustomers);
    case "overview.ticketGrowthPct":
      return `${overview.kpis.ticketGrowthPct > 0 ? "+" : ""}${overview.kpis.ticketGrowthPct}%`;
    case "overview.estimatedImpact":
      return money.format(overview.kpis.estimatedImpact);
    default:
      return "—";
  }
}

function MetricWidget({
  widget,
  data,
}: {
  widget: DashboardWidget;
  data: DashboardRuntimeData;
}) {
  const binding = resolveMetricBinding(widget);
  const formulaValue = formulaMetricValue(widget, data);
  return (
    <article
      className={`ai-dashboard-widget metric ${widget.size} ${widget.tone}`}
    >
      <div className="ai-widget-icon">
        <MetricIcon binding={binding} />
      </div>
      <div>
        <span>{widget.title}</span>
        <strong>{formulaValue ?? metricValue(binding, data.overview)}</strong>
        <small>{widget.description}</small>
      </div>
    </article>
  );
}

function TimeseriesWidget({
  widget,
  data,
}: {
  widget: DashboardWidget;
  data: DashboardRuntimeData;
}) {
  return (
    <article
      className={`ai-dashboard-widget timeseries ${widget.size} ${widget.tone}`}
    >
      <header className="ai-widget-heading">
        <div>
          <span className="section-label">Atualização via API</span>
          <h2>{widget.title}</h2>
          <p>{widget.description}</p>
        </div>
        <Activity size={21} />
      </header>
      <div className="ai-dashboard-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data.overview.weeklyTickets}
            margin={{ top: 10, right: 8, left: -25, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id={`ai-${widget.id}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="var(--ixc-accent)"
                  stopOpacity={0.32}
                />
                <stop
                  offset="100%"
                  stopColor="var(--ixc-accent)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--ixc-grid)"
              strokeDasharray="4 4"
            />
            <XAxis dataKey="week" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                border: "0",
                borderRadius: 12,
                boxShadow: "0 18px 42px rgba(0,0,0,.28)",
              }}
              labelFormatter={(label) => `Semana de ${label}`}
            />
            <Area
              type="monotone"
              dataKey="total"
              name="Chamados"
              stroke="var(--ixc-accent)"
              strokeWidth={3}
              fill={`url(#ai-${widget.id})`}
              dot={{ r: 3, fill: "var(--ixc-surface-1)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function AlertsWidget({
  widget,
  data,
}: {
  widget: DashboardWidget;
  data: DashboardRuntimeData;
}) {
  const detected = widget.binding === "overview.detectedIncidents";
  const items = detected
    ? data.overview.incidents.map((incident) => ({
        id: incident.id,
        severity: incident.severity,
        title: incident.title,
        detail: incident.location,
        affected: incident.affected,
      }))
    : data.activeIncidents.data.map((incident) => ({
        id: incident.incident_id,
        severity: incident.severity,
        title: incident.title,
        detail: incident.probable_cause,
        affected: incident.affected_cpes,
      }));

  return (
    <article
      className={`ai-dashboard-widget list ${widget.size} ${widget.tone}`}
    >
      <header className="ai-widget-heading">
        <div>
          <span className="section-label">
            {detected ? "Sinais analíticos" : "Operação confirmada"}
          </span>
          <h2>{widget.title}</h2>
          <p>{widget.description}</p>
        </div>
        <AlertTriangle size={21} />
      </header>
      <div className="ai-alert-list">
        {items.slice(0, 4).map((item) => (
          <div key={item.id} className={`ai-alert-row ${item.severity}`}>
            <span className="ai-alert-dot" />
            <div>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </div>
            <b>{number.format(item.affected)}</b>
          </div>
        ))}
        {items.length === 0 && (
          <div className="ai-widget-empty">
            Nenhum incidente ativo nesta fonte.
          </div>
        )}
      </div>
    </article>
  );
}

function QueueWidget({
  widget,
  data,
}: {
  widget: DashboardWidget;
  data: DashboardRuntimeData;
}) {
  return (
    <article
      className={`ai-dashboard-widget list ${widget.size} ${widget.tone}`}
    >
      <header className="ai-widget-heading">
        <div>
          <span className="section-label">Fluxo N1 → NOC</span>
          <h2>{widget.title}</h2>
          <p>{widget.description}</p>
        </div>
        <Clock3 size={21} />
      </header>
      <div className="ai-queue-summary">
        <div>
          <strong>{number.format(data.nocQueue.meta.summary.received)}</strong>
          <span>Recebidos</span>
        </div>
        <div>
          <strong>
            {number.format(data.nocQueue.meta.summary.inProgress)}
          </strong>
          <span>Em andamento</span>
        </div>
        <div>
          <strong>{number.format(data.nocQueue.totalItems)}</strong>
          <span>Total na fila</span>
        </div>
      </div>
    </article>
  );
}

function NarrativeWidget({
  widget,
  data,
}: {
  widget: DashboardWidget;
  data: DashboardRuntimeData;
}) {
  return (
    <article
      className={`ai-dashboard-widget narrative ${widget.size} ${widget.tone}`}
    >
      <div className="ai-narrative-mark">
        <Sparkles size={21} />
      </div>
      <div>
        <span className="section-label">Síntese disponível na API</span>
        <h2>{widget.title}</h2>
        <strong>{data.overview.readout.headline}</strong>
        <p>{data.overview.readout.summary}</p>
      </div>
    </article>
  );
}

function Widget({
  widget,
  data,
  filters,
  editMode,
  onEdit,
  onDrilldown,
  dragging,
  onDragStart,
  onDragEnd,
  onDrop,
  onResize,
}: {
  widget: DashboardWidget;
  data: DashboardRuntimeData;
  filters: InventoryFilter[];
  editMode: boolean;
  onEdit: (widget: DashboardWidget) => void;
  onDrilldown: (drilldown: DashboardDrilldown) => void;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onResize: (columns: number) => void;
}) {
  const columns = widget.columns ?? defaultWidgetColumns(widget);
  const shellRef = useRef<HTMLDivElement>(null);
  const resizeStart = useRef<{
    pointerId: number;
    startX: number;
    startColumns: number;
    columnStep: number;
  } | null>(null);
  const [resizing, setResizing] = useState(false);

  function startResize(event: ReactPointerEvent<HTMLButtonElement>) {
    const grid = shellRef.current?.parentElement;
    if (!grid) return;
    event.preventDefault();
    event.stopPropagation();
    const styles = window.getComputedStyle(grid);
    const gap = Number.parseFloat(styles.columnGap) || 0;
    const width = grid.getBoundingClientRect().width;
    resizeStart.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startColumns: columns,
      columnStep: Math.max((width - gap * 23) / 24 + gap, 1),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(true);
  }

  function continueResize(event: ReactPointerEvent<HTMLButtonElement>) {
    const start = resizeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    event.preventDefault();
    const deltaColumns = Math.round(
      (event.clientX - start.startX) / start.columnStep,
    );
    onResize(Math.max(4, Math.min(24, start.startColumns + deltaColumns)));
  }

  function finishResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (resizeStart.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeStart.current = null;
    setResizing(false);
  }

  let content: ReactNode;
  if (widget.kind === "metric") {
    content = <MetricWidget widget={widget} data={data} />;
  } else if (widget.kind === "timeseries") {
    content = <TimeseriesWidget widget={widget} data={data} />;
  } else if (widget.kind === "alerts") {
    content = <AlertsWidget widget={widget} data={data} />;
  } else if (widget.kind === "queue") {
    content = <QueueWidget widget={widget} data={data} />;
  } else if (widget.kind === "bar") {
    content = (
      <BarWidget widget={widget} data={data} onDrilldown={onDrilldown} />
    );
  } else if (widget.kind === "pie") {
    content = (
      <PieWidget widget={widget} data={data} onDrilldown={onDrilldown} />
    );
  } else if (widget.kind === "multiseries") {
    content = (
      <MultiSeriesWidget
        widget={widget}
        data={data}
        onDrilldown={onDrilldown}
      />
    );
  } else if (widget.kind === "table") {
    content = (
      <TableWidget
        widget={widget}
        data={data}
        filters={filters}
        onDrilldown={onDrilldown}
      />
    );
  } else if (widget.kind === "topology") {
    content = (
      <TopologyWidget widget={widget} data={data} onDrilldown={onDrilldown} />
    );
  } else if (widget.kind === "map") {
    content = (
      <MapWidget widget={widget} data={data} onDrilldown={onDrilldown} />
    );
  } else {
    content = <NarrativeWidget widget={widget} data={data} />;
  }

  return (
    <div
      ref={shellRef}
      className={`ai-dashboard-widget-shell ${widget.size} ${editMode ? "editing" : ""} ${dragging ? "dragging" : ""} ${resizing ? "resizing" : ""}`}
      style={{ "--widget-columns": columns } as CSSProperties}
      draggable={editMode && !resizing}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event) => editMode && event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
    >
      {content}
      {editMode && (
        <span className="ai-widget-drag-handle" aria-hidden="true">
          <GripVertical size={14} />
        </span>
      )}
      {editMode && (
        <button
          className="ai-widget-edit-control"
          type="button"
          aria-label={`Editar bloco ${widget.title}`}
          title={`Editar ${widget.title}`}
          onClick={() => onEdit(widget)}
        >
          <Pencil size={13} />
        </button>
      )}
      {editMode && (
        <button
          className="ai-widget-resize-edge"
          type="button"
          aria-label={`Redimensionar ${widget.title}. Largura atual: ${columns} de 24 colunas`}
          title="Arraste a borda para redimensionar"
          draggable={false}
          onPointerDown={startResize}
          onPointerMove={continueResize}
          onPointerUp={finishResize}
          onPointerCancel={finishResize}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              onResize(columns - 1);
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              onResize(columns + 1);
            } else if (event.key === "Home") {
              event.preventDefault();
              onResize(4);
            } else if (event.key === "End") {
              event.preventDefault();
              onResize(24);
            }
          }}
        >
          <span className="ai-widget-resize-count" aria-hidden="true">
            {columns}/24
          </span>
          <span className="ai-widget-resize-grip" aria-hidden="true">
            <GripVertical size={13} />
          </span>
        </button>
      )}
    </div>
  );
}

export function DynamicDashboard({
  initialOverview,
  userId,
  onOpenOfflineDiagnosis,
  fallback,
}: DynamicDashboardProps) {
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const [activeDashboardId, setActiveDashboardId] = useState<string | null>(
    null,
  );
  const [loadingDashboardId, setLoadingDashboardId] = useState<string | null>(
    null,
  );
  const [plan, setPlan] = useState<DashboardComposition | null>(null);
  const [data, setData] = useState<DashboardRuntimeData | null>(null);
  const [editInstruction, setEditInstruction] = useState("");
  const [composing, setComposing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editor, setEditor] = useState<DashboardEditor | null>(null);
  const [period, setPeriod] = useState("30");
  const [filters, setFilters] = useState<InventoryFilter[]>([]);
  const [filterQuery, setFilterQuery] = useState("");
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [planDirty, setPlanDirty] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [drilldown, setDrilldown] = useState<DashboardDrilldown | null>(null);
  const [runtimeWarnings, setRuntimeWarnings] = useState<string[]>([]);
  const [offlineAlerts, setOfflineAlerts] = useState<OfflineAlertPage | null>(
    null,
  );
  const [offlineAlertsLoading, setOfflineAlertsLoading] = useState(true);
  const [offlineAlertsError, setOfflineAlertsError] = useState("");
  const [error, setError] = useState("");
  const initialized = useRef(false);
  const saveRevision = useRef(0);
  const runtimeRevision = useRef(0);
  const activeDashboardRef = useRef<string | null>(null);
  const activePlanRef = useRef<DashboardComposition | null>(null);
  const runtimeDataRef = useRef<DashboardRuntimeData | null>(null);

  const loadOfflineAlerts = useCallback(async () => {
    setOfflineAlertsLoading(true);
    try {
      setOfflineAlerts(await api.offlineAlerts());
      setOfflineAlertsError("");
    } catch (reason) {
      setOfflineAlertsError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível verificar os relatos recentes.",
      );
    } finally {
      setOfflineAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOfflineAlerts();
    const timer = window.setInterval(() => void loadOfflineAlerts(), 60_000);
    return () => window.clearInterval(timer);
  }, [loadOfflineAlerts]);

  const loadRuntimeData = useCallback(
    async (dashboardId: string) => {
      const revision = ++runtimeRevision.current;
      setRefreshing(true);
      const previous =
        runtimeDataRef.current ?? emptyRuntimeData(initialOverview);
      const needs = runtimeNeeds(activePlanRef.current?.widgets ?? []);
      try {
        const from = periodStart(period);
        const results = await Promise.allSettled([
          needs.overview ? api.overview() : Promise.resolve(previous.overview),
          needs.activeIncidents
            ? api.operationalIncidents()
            : Promise.resolve(previous.activeIncidents),
          needs.nocQueue ? api.nocQueue() : Promise.resolve(previous.nocQueue),
          needs.topology ? api.topology() : Promise.resolve(previous.topology),
          needs.inventory
            ? api.dashboardInventory(filters)
            : Promise.resolve(previous.inventory),
          needs.telemetry
            ? api.dashboardTelemetry(from)
            : Promise.resolve(previous.telemetry),
          needs.diagnostics
            ? api.dashboardDiagnostics(from)
            : Promise.resolve(previous.diagnostics),
        ]);
        const warnings: string[] = [];
        const nextData = {
          overview: settledValue(
            results[0],
            previous.overview,
            "visão geral",
            warnings,
          ),
          activeIncidents: settledValue(
            results[1],
            previous.activeIncidents,
            "incidentes operacionais",
            warnings,
          ),
          nocQueue: settledValue(
            results[2],
            previous.nocQueue,
            "fila do NOC",
            warnings,
          ),
          topology: settledValue(
            results[3],
            previous.topology,
            "topologia",
            warnings,
          ),
          inventory: settledValue(
            results[4],
            previous.inventory,
            "inventário",
            warnings,
          ),
          telemetry: settledValue(
            results[5],
            previous.telemetry,
            "telemetria",
            warnings,
          ),
          diagnostics: settledValue(
            results[6],
            previous.diagnostics,
            "diagnósticos",
            warnings,
          ),
          fetchedAt: new Date().toISOString(),
        };
        if (
          activeDashboardRef.current !== dashboardId ||
          runtimeRevision.current !== revision
        ) {
          return;
        }
        runtimeDataRef.current = nextData;
        setData(nextData);
        setRuntimeWarnings(warnings);
        setError("");
      } catch (reason) {
        if (
          activeDashboardRef.current !== dashboardId ||
          runtimeRevision.current !== revision
        ) {
          return;
        }
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível atualizar os dados REST.",
        );
      } finally {
        if (runtimeRevision.current === revision) setRefreshing(false);
      }
    },
    [filters, initialOverview, period],
  );

  const activateDashboard = useCallback(
    async (dashboardId: string, knownDashboard?: DashboardDetail) => {
      activeDashboardRef.current = dashboardId;
      activePlanRef.current = null;
      setActiveDashboardId(dashboardId);
      setLoadingDashboardId(dashboardId);
      setData(null);
      runtimeDataRef.current = null;
      setPlan(null);
      setPlanDirty(false);
      setSaveState("idle");
      setRuntimeWarnings([]);
      const cachedPlan = loadSavedPlan(userId, dashboardId);
      try {
        const dashboard =
          knownDashboard ?? (await api.dashboardById(userId, dashboardId));
        if (activeDashboardRef.current !== dashboardId) return;
        const nextPlan = normalizeComposition(dashboard.composition);
        setDashboards((current) =>
          current.some((item) => item.dashboardId === dashboard.dashboardId)
            ? current.map((item) =>
                item.dashboardId === dashboard.dashboardId ? dashboard : item,
              )
            : [...current, dashboard],
        );
        savePlan(userId, dashboardId, nextPlan);
        try {
          window.localStorage.setItem(
            activeDashboardStorageKey(userId),
            dashboardId,
          );
        } catch {
          // O dashboard segue ativo em memória se o storage estiver bloqueado.
        }
        activePlanRef.current = nextPlan;
        setPlan(nextPlan);
        await loadRuntimeData(dashboardId);
        if (activeDashboardRef.current === dashboardId) {
          setLoadingDashboardId(null);
        }
      } catch (reason) {
        if (cachedPlan && activeDashboardRef.current === dashboardId) {
          activePlanRef.current = cachedPlan;
          setPlan(cachedPlan);
          setLoadingDashboardId(null);
          setError(
            "A API está indisponível. Exibindo a última composição salva neste navegador.",
          );
          return;
        }
        if (activeDashboardRef.current === dashboardId) {
          setLoadingDashboardId(null);
        }
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível carregar este dashboard.",
        );
      }
    },
    [loadRuntimeData, userId],
  );

  const compose = useCallback(
    async (
      nextObjective: string,
      currentPlan?: DashboardComposition,
      targetWidgetId?: string,
    ) => {
      setComposing(true);
      setError("");
      try {
        const nextPlan = normalizeComposition(
          await api.composeDashboard(
            nextObjective,
            currentPlan,
            targetWidgetId,
          ),
        );
        activePlanRef.current = nextPlan;
        setPlan(nextPlan);
        setPlanDirty(true);
        setEditor(null);
        setEditInstruction("");
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível compor o dashboard.",
        );
      } finally {
        setComposing(false);
      }
    },
    [],
  );

  const createDashboardFromInstruction = useCallback(
    async (objective: string) => {
      setComposing(true);
      setError("");
      try {
        const nextPlan = normalizeComposition(
          await api.composeDashboard(objective),
        );
        const created = await api.createDashboard(userId, {
          name: nextPlan.title,
          description: nextPlan.subtitle,
          composition: nextPlan,
          isDefault: dashboards.length === 0,
        });
        setDashboards((current) => [
          created,
          ...current.filter((item) => item.dashboardId !== created.dashboardId),
        ]);
        await activateDashboard(created.dashboardId, created);
        setEditor(null);
        setEditInstruction("");
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível criar o dashboard.",
        );
      } finally {
        setComposing(false);
      }
    },
    [activateDashboard, dashboards.length, userId],
  );

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const library = await api.dashboardLibrary(userId);
        if (cancelled) return;
        setDashboards(library.data);
        setLibraryLoaded(true);
        if (library.data.length > 0) {
          let savedDashboardId = "";
          try {
            savedDashboardId =
              window.localStorage.getItem(activeDashboardStorageKey(userId)) ??
              "";
          } catch {
            // O servidor continua sendo a fonte de seleção quando não há storage.
          }
          const selected =
            library.data.find(
              (item) => item.dashboardId === savedDashboardId,
            ) ??
            library.data.find(
              (item) => item.dashboardId === library.defaultDashboardId,
            ) ??
            library.data[0];
          await activateDashboard(selected.dashboardId);
        } else {
          await createDashboardFromInstruction(defaultObjective);
        }
      } catch (reason) {
        setLibraryLoaded(true);
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível carregar os dashboards.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activateDashboard, createDashboardFromInstruction, userId]);

  useEffect(() => {
    if (!libraryLoaded || !plan || !activeDashboardId || !planDirty) return;
    savePlan(userId, activeDashboardId, plan);
    const revision = ++saveRevision.current;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      void api
        .saveDashboard(userId, activeDashboardId, {
          name: plan.title,
          description: plan.subtitle,
          composition: plan,
          isDefault:
            dashboards.find((item) => item.dashboardId === activeDashboardId)
              ?.isDefault ?? false,
        })
        .then((saved) => {
          if (saveRevision.current !== revision) return;
          setDashboards((current) =>
            current.map((item) =>
              item.dashboardId === saved.dashboardId ? saved : item,
            ),
          );
          setPlanDirty(false);
          setSaveState("saved");
        })
        .catch(() => {
          if (saveRevision.current === revision) setSaveState("error");
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [activeDashboardId, dashboards, libraryLoaded, plan, planDirty, userId]);

  useEffect(() => {
    if (activeDashboardId && activePlanRef.current) {
      void loadRuntimeData(activeDashboardId);
    }
  }, [activeDashboardId, filters, loadRuntimeData, period]);

  useEffect(() => {
    if (!plan || !activeDashboardId) return;
    const timer = window.setInterval(
      () => void loadRuntimeData(activeDashboardId),
      plan.refreshSeconds * 1_000,
    );
    return () => window.clearInterval(timer);
  }, [activeDashboardId, loadRuntimeData, plan]);

  useEffect(() => {
    if (!editor) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !composing) setEditor(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [editor, composing]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = editInstruction.trim();
    if (value.length < 8 || !editor) return;
    if (editor.scope === "create") {
      void createDashboardFromInstruction(value);
    } else if (plan) {
      void compose(
        value,
        plan,
        editor.scope === "widget" ? editor.widgetId : undefined,
      );
    }
  }

  const selectedWidget =
    editor?.scope === "widget"
      ? plan?.widgets.find((widget) => widget.id === editor.widgetId)
      : undefined;

  function openDashboardEditor() {
    setEditInstruction("");
    setEditor({ scope: "dashboard", widgetId: null });
  }

  function openCreateEditor() {
    setEditInstruction("");
    setEditor({ scope: "create", widgetId: null });
  }

  function openWidgetEditor(widget: DashboardWidget) {
    setEditInstruction("");
    setEditor({ scope: "widget", widgetId: widget.id });
  }

  function moveWidget(targetWidgetId: string) {
    if (!plan || !draggedWidgetId || draggedWidgetId === targetWidgetId) {
      setDraggedWidgetId(null);
      return;
    }
    const widgets = [...plan.widgets];
    const from = widgets.findIndex((widget) => widget.id === draggedWidgetId);
    const to = widgets.findIndex((widget) => widget.id === targetWidgetId);
    if (from < 0 || to < 0) return;
    const [moved] = widgets.splice(from, 1);
    widgets.splice(to, 0, moved);
    const nextPlan = {
      ...plan,
      widgets,
      generatedAt: new Date().toISOString(),
    };
    activePlanRef.current = nextPlan;
    setPlan(nextPlan);
    setPlanDirty(true);
    setDraggedWidgetId(null);
  }

  function resizeWidget(widgetId: string, requestedColumns: number) {
    if (!plan) return;
    const columns = Math.max(4, Math.min(24, requestedColumns));
    const size: DashboardWidget["size"] =
      columns <= 8 ? "compact" : columns < 24 ? "half" : "wide";
    const nextPlan = {
      ...plan,
      generatedAt: new Date().toISOString(),
      widgets: plan.widgets.map((widget) =>
        widget.id === widgetId ? { ...widget, columns, size } : widget,
      ),
    };
    activePlanRef.current = nextPlan;
    setPlan(nextPlan);
    setPlanDirty(true);
  }

  const latestData =
    data ?? runtimeDataRef.current ?? emptyRuntimeData(initialOverview);

  const offlinePanel = (
    <OfflineClientsPanel
      page={offlineAlerts}
      loading={offlineAlertsLoading}
      error={offlineAlertsError}
      onRefresh={() => void loadOfflineAlerts()}
      onDiagnose={onOpenOfflineDiagnosis}
    />
  );

  if (!plan && !composing && error) {
    return (
      <section className="dynamic-dashboard">
        <div className="ai-dashboard-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error} Exibindo a visão executiva disponível.</span>
        </div>
        {offlinePanel}
        {fallback}
      </section>
    );
  }

  return (
    <section className="dynamic-dashboard">
      {error && (
        <div className="ai-dashboard-error" role="alert">
          <AlertTriangle size={17} /> {error}
        </div>
      )}
      {plan && runtimeWarnings.length > 0 && (
        <div className="ai-dashboard-data-warning" role="status">
          <AlertTriangle size={16} />
          <span>
            Algumas fontes estão indisponíveis ({runtimeWarnings.join(", ")}).
            Exibindo o último dado disponível onde houver.
          </span>
        </div>
      )}

      {offlinePanel}

      {plan ? (
        <>
          <div className="ai-dashboard-toolbar">
            <div>
              <div className="ai-dashboard-selector">
                <label htmlFor="dashboard-library-select">Dashboard</label>
                <select
                  id="dashboard-library-select"
                  aria-label="Selecionar dashboard"
                  value={activeDashboardId ?? ""}
                  onChange={(event) =>
                    void activateDashboard(event.target.value)
                  }
                  disabled={composing}
                >
                  {dashboards.map((dashboard) => (
                    <option
                      key={dashboard.dashboardId}
                      value={dashboard.dashboardId}
                    >
                      {dashboard.name}
                    </option>
                  ))}
                </select>
                <button
                  className="ai-new-dashboard-button"
                  type="button"
                  onClick={openCreateEditor}
                  disabled={composing}
                >
                  <Sparkles size={14} />
                  Novo dashboard
                </button>
              </div>
              <span className={`ai-plan-source ${plan.generatedBy}`}>
                {plan.generatedBy === "openai"
                  ? `Composição por IA · ${plan.model}`
                  : "Composição de demonstração · plano salvo"}
              </span>
              <span>
                {discoveredResourceCount(plan)} recursos REST descobertos pelo
                OpenAPI · dados não enviados ao modelo
              </span>
              <span className={`ai-dashboard-save-state ${saveState}`}>
                {saveState === "saving" && "Salvando configuração…"}
                {saveState === "saved" && "Configuração salva para você"}
                {saveState === "error" &&
                  "Salva neste navegador; servidor indisponível"}
              </span>
            </div>
            <div className="ai-dashboard-actions">
              <button
                className={`ai-edit-mode-button ${editMode ? "active" : ""}`}
                type="button"
                onClick={() => setEditMode((active) => !active)}
              >
                {editMode ? <Check size={14} /> : <Pencil size={14} />}
                {editMode ? "Concluir edição" : "Editar dashboard"}
              </button>
              {editMode && (
                <button
                  className="ai-personalize-button"
                  type="button"
                  onClick={openDashboardEditor}
                >
                  <Sparkles size={14} />
                  Personalizar com IA
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (activeDashboardId)
                    void loadRuntimeData(activeDashboardId);
                }}
                disabled={refreshing}
              >
                <RefreshCw
                  className={refreshing ? "spin" : undefined}
                  size={15}
                />
                {refreshing ? "Atualizando…" : "Atualizar dados"}
              </button>
            </div>
          </div>
          {editMode && (
            <div className="ai-edit-mode-notice" role="status">
              <Pencil size={13} />
              <span>
                Modo de edição ativo. Arraste para reorganizar, use a alça da
                borda direita para redimensionar ou edite o conteúdo com IA.
              </span>
            </div>
          )}
          <div
            className="ai-dashboard-filters"
            aria-label="Filtros do dashboard"
          >
            <label>
              <span>Período</span>
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              >
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="90">Últimos 90 dias</option>
                <option value="all">Todo o histórico</option>
              </select>
            </label>
            <div className="ai-dashboard-filter-group">
              <span>Filtrar listas</span>
              <InventoryFilterSelect
                filters={filters}
                onChange={setFilters}
                query={filterQuery}
                onQueryChange={setFilterQuery}
                placeholder="Cliente, serial, cidade, OLT…"
                ariaLabel="Adicionar filtros às listas do dashboard"
                optionsId="dashboard-filter-options"
                compact
              />
            </div>
          </div>
          <div className="ai-dashboard-grid" aria-live="polite">
            {plan.widgets.map((widget) => (
              <Widget
                key={widget.id}
                widget={widget}
                data={latestData}
                filters={filters}
                editMode={editMode}
                onEdit={openWidgetEditor}
                onDrilldown={setDrilldown}
                dragging={draggedWidgetId === widget.id}
                onDragStart={() => setDraggedWidgetId(widget.id)}
                onDragEnd={() => setDraggedWidgetId(null)}
                onDrop={() => moveWidget(widget.id)}
                onResize={(columns) => resizeWidget(widget.id, columns)}
              />
            ))}
          </div>
          <footer className="ai-dashboard-provenance">
            <span>
              Layout gerado {new Date(plan.generatedAt).toLocaleString("pt-BR")}
              .
            </span>
            <span>
              Dados REST atualizados{" "}
              {new Date(latestData.fetchedAt).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · renovação automática a cada{" "}
              {Math.round(plan.refreshSeconds / 60)} min.
            </span>
          </footer>

          {editor && (
            <div
              className="ai-composer-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !composing) {
                  setEditor(null);
                }
              }}
            >
              <section
                className="ai-composer-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ai-composer-title"
              >
                <header>
                  <div className="ai-composer-modal-icon" aria-hidden="true">
                    <Bot size={21} />
                  </div>
                  <div>
                    <span className="section-label">Edição por conversa</span>
                    <h2 id="ai-composer-title">
                      {editor.scope === "create"
                        ? "Criar novo dashboard"
                        : selectedWidget
                          ? `Editar bloco: ${selectedWidget.title}`
                          : "Personalizar dashboard"}
                    </h2>
                    <p>
                      {editor.scope === "create"
                        ? "Descreva o que este novo dashboard deve acompanhar. Ele será adicionado ao seletor sem alterar os dashboards existentes."
                        : selectedWidget
                          ? "Explique o que deve mudar somente neste bloco. O restante do dashboard será preservado."
                          : "Explique a mudança desejada. A IA considera a composição atual em vez de começar do zero."}
                    </p>
                  </div>
                  <button
                    className="ai-composer-close"
                    type="button"
                    aria-label="Fechar personalização"
                    onClick={() => setEditor(null)}
                    disabled={composing}
                  >
                    <X size={18} />
                  </button>
                </header>

                <form className="ai-dashboard-composer" onSubmit={submit}>
                  <label>
                    <span>
                      {editor.scope === "create"
                        ? "O que este dashboard deve acompanhar?"
                        : selectedWidget
                          ? "O que você quer mudar neste bloco?"
                          : "Como você quer alterar este dashboard?"}
                    </span>
                    <textarea
                      autoFocus
                      value={editInstruction}
                      onChange={(event) =>
                        setEditInstruction(event.target.value)
                      }
                      minLength={8}
                      maxLength={600}
                      rows={4}
                      placeholder={
                        editor.scope === "create"
                          ? "Ex.: acompanhe incidentes críticos, fila do NOC e clientes afetados"
                          : selectedWidget
                            ? "Ex.: transforme este bloco em uma métrica de clientes afetados"
                            : "Ex.: mantenha os alertas e dê mais destaque à fila do NOC"
                      }
                    />
                  </label>
                  <div
                    className="ai-composer-suggestions"
                    aria-label="Sugestões de dashboard"
                  >
                    {(editor.scope === "create"
                      ? suggestions
                      : selectedWidget
                        ? widgetSuggestions
                        : suggestions
                    ).map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setEditInstruction(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                  <p className="ai-composer-note">
                    {editor.scope === "create"
                      ? "A instrução e o catálogo MCP são enviados ao modelo para gerar somente o plano visual. Os dados operacionais continuam via REST."
                      : "O plano visual atual, sua instrução e o catálogo MCP são enviados ao modelo. Os dados operacionais continuam via REST e não usam tokens."}
                  </p>
                  <footer>
                    <button
                      className="ai-composer-cancel"
                      type="button"
                      onClick={() => setEditor(null)}
                      disabled={composing}
                    >
                      Cancelar
                    </button>
                    <button
                      className="ai-composer-submit"
                      type="submit"
                      disabled={composing || editInstruction.trim().length < 8}
                    >
                      {composing ? (
                        <RefreshCw className="spin" size={17} />
                      ) : (
                        <Send size={17} />
                      )}
                      {composing
                        ? editor.scope === "create"
                          ? "Criando…"
                          : "Aplicando…"
                        : editor.scope === "create"
                          ? "Criar dashboard"
                          : "Aplicar alteração"}
                    </button>
                  </footer>
                </form>
              </section>
            </div>
          )}
          {drilldown && (
            <DashboardDetailModal
              drilldown={drilldown}
              onClose={() => setDrilldown(null)}
            />
          )}
        </>
      ) : (
        <div className="ai-dashboard-loading" aria-live="polite">
          <span />
          <strong>
            {loadingDashboardId
              ? "Carregando o dashboard selecionado…"
              : "Descobrindo recursos e montando a primeira composição…"}
          </strong>
          <small>
            {loadingDashboardId
              ? "A composição e os dados operacionais estão sendo atualizados."
              : "Os dados operacionais continuam fora do contexto do modelo."}
          </small>
        </div>
      )}
    </section>
  );
}
