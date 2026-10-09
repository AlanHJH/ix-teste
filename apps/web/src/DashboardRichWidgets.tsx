import { BarChart3, List, Map, Network } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DashboardBinding,
  DashboardRuntimeData,
  DashboardWidget,
  InventoryFilter,
} from "./types";
import type { DashboardDrilldown } from "./DashboardDetailModal";
import { DateRangeFilter, type DateRange } from "./DateRangeFilter";
import { SortableHeader } from "./SortableHeader";

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const colors = [
  "var(--ixc-accent)",
  "#c84fb7",
  "#ef7c6f",
  "#7fadd1",
  "#8e7be0",
];

type Drilldown = (drilldown: DashboardDrilldown) => void;

function drilldownKey(event: React.KeyboardEvent, onOpen: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onOpen();
  }
}

function scalar(binding: DashboardBinding, data: DashboardRuntimeData) {
  const values: Partial<Record<DashboardBinding, number>> = {
    "overview.activeCpes": data.overview.kpis.activeCpes,
    "overview.oltCount": data.overview.kpis.oltCount,
    "overview.ponCount": data.overview.kpis.ponCount,
    "overview.affectedCpes": data.overview.kpis.affectedCpes,
    "overview.repeatCustomers": data.overview.kpis.repeatCustomers,
    "overview.ticketGrowthPct": data.overview.kpis.ticketGrowthPct,
    "overview.estimatedImpact": data.overview.kpis.estimatedImpact,
  };
  return values[binding] ?? 0;
}

export function formulaMetricValue(
  widget: DashboardWidget,
  data: DashboardRuntimeData,
): string | null {
  const formula = widget.config?.formula;
  if (!formula) return null;
  const operands = formula.operands.map((binding) => scalar(binding, data));
  let result = 0;
  if (formula.operation === "sum") {
    result = operands.reduce((sum, value) => sum + value, 0);
  } else if (formula.operation === "average") {
    result = operands.reduce((sum, value) => sum + value, 0) / operands.length;
  } else if (formula.operation === "difference") {
    result = operands
      .slice(1)
      .reduce((value, item) => value - item, operands[0]);
  } else if (formula.operation === "ratio") {
    result = operands[1] === 0 ? 0 : operands[0] / operands[1];
  } else {
    result = operands[1] === 0 ? 0 : (operands[0] / operands[1]) * 100;
  }
  return `${result.toFixed(formula.decimals)}${formula.suffix}`;
}

function Heading({
  widget,
  icon,
}: {
  widget: DashboardWidget;
  icon: React.ReactNode;
}) {
  return (
    <header className="ai-widget-heading">
      <div>
        <span className="section-label">Visualização dinâmica</span>
        <h2>{widget.title}</h2>
        <p>{widget.description}</p>
      </div>
      {icon}
    </header>
  );
}

function ticketMix(data: DashboardRuntimeData) {
  return [
    {
      name: "Lentidão",
      value: data.overview.weeklyTickets.reduce(
        (sum, item) => sum + item.slowness,
        0,
      ),
    },
    {
      name: "Sem conexão",
      value: data.overview.weeklyTickets.reduce(
        (sum, item) => sum + item.disconnected,
        0,
      ),
    },
    {
      name: "Wi-Fi",
      value: data.overview.weeklyTickets.reduce(
        (sum, item) => sum + item.wifi,
        0,
      ),
    },
  ];
}

function chartData(widget: DashboardWidget, data: DashboardRuntimeData) {
  return widget.binding === "network.topology"
    ? data.topology.olts.map((olt) => ({ name: olt.olt, value: olt.cpes }))
    : ticketMix(data);
}

export function BarWidget({
  widget,
  data,
  onDrilldown,
}: {
  widget: DashboardWidget;
  data: DashboardRuntimeData;
  onDrilldown: Drilldown;
}) {
  const values = chartData(widget, data);
  const openDetails = () =>
    onDrilldown({
      kind: "chart",
      title: widget.title,
      binding: widget.binding,
      value: values.map((item) => ({ ...item })),
    });
  return (
    <article className={`ai-dashboard-widget rich-chart ${widget.tone}`}>
      <Heading widget={widget} icon={<BarChart3 size={21} />} />
      <button className="ai-data-action" type="button" onClick={openDetails}>
        Ver dados
      </button>
      <div
        className="ai-dashboard-chart rich interactive"
        role="button"
        tabIndex={0}
        aria-label={`Abrir detalhes de ${widget.title}`}
        onClick={openDetails}
        onKeyDown={(event) => drilldownKey(event, openDetails)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={values} margin={{ top: 10, right: 8, left: -24 }}>
            <CartesianGrid
              vertical={false}
              stroke="var(--ixc-grid)"
              strokeDasharray="4 4"
            />
            <XAxis dataKey="name" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip />
            <Bar
              dataKey="value"
              name="Quantidade"
              fill="var(--ixc-accent)"
              radius={[7, 7, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export function PieWidget({
  widget,
  data,
  onDrilldown,
}: {
  widget: DashboardWidget;
  data: DashboardRuntimeData;
  onDrilldown: Drilldown;
}) {
  const values = chartData(widget, data);
  const openDetails = () =>
    onDrilldown({
      kind: "chart",
      title: widget.title,
      binding: widget.binding,
      value: values.map((item) => ({ ...item })),
    });
  return (
    <article className={`ai-dashboard-widget rich-chart ${widget.tone}`}>
      <Heading widget={widget} icon={<BarChart3 size={21} />} />
      <button className="ai-data-action" type="button" onClick={openDetails}>
        Ver dados
      </button>
      <div
        className="ai-dashboard-chart rich interactive"
        role="button"
        tabIndex={0}
        aria-label={`Abrir detalhes de ${widget.title}`}
        onClick={openDetails}
        onKeyDown={(event) => drilldownKey(event, openDetails)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={values}
              dataKey="value"
              nameKey="name"
              innerRadius={46}
              outerRadius={78}
              paddingAngle={3}
            >
              {values.map((item, index) => (
                <Cell key={item.name} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export function MultiSeriesWidget({
  widget,
  data,
  onDrilldown,
}: {
  widget: DashboardWidget;
  data: DashboardRuntimeData;
  onDrilldown: Drilldown;
}) {
  const openDetails = () =>
    onDrilldown({
      kind: "chart",
      title: widget.title,
      binding: widget.binding,
      value: data.overview.weeklyTickets.map((item) => ({ ...item })),
    });
  return (
    <article className={`ai-dashboard-widget rich-chart ${widget.tone}`}>
      <Heading widget={widget} icon={<BarChart3 size={21} />} />
      <button className="ai-data-action" type="button" onClick={openDetails}>
        Ver dados
      </button>
      <div
        className="ai-dashboard-chart rich interactive"
        role="button"
        tabIndex={0}
        aria-label={`Abrir detalhes de ${widget.title}`}
        onClick={openDetails}
        onKeyDown={(event) => drilldownKey(event, openDetails)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data.overview.weeklyTickets}
            margin={{ top: 10, right: 12, left: -24 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--ixc-grid)"
              strokeDasharray="4 4"
            />
            <XAxis dataKey="week" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="slowness"
              name="Lentidão"
              stroke={colors[0]}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="disconnected"
              name="Sem conexão"
              stroke={colors[2]}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="wifi"
              name="Wi-Fi"
              stroke={colors[3]}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function tableSource(widget: DashboardWidget, data: DashboardRuntimeData) {
  if (widget.binding === "telemetry.dailyMetrics") return data.telemetry.data;
  if (widget.binding === "diagnostics.list") return data.diagnostics.data;
  return data.inventory.data;
}

function columns(widget: DashboardWidget) {
  if (widget.binding === "inventory.customers") {
    return ["customer_id", "city", "neighborhood", "plan_mbps", "status"];
  }
  if (widget.binding === "inventory.equipment") {
    return ["serial", "vendor", "model", "software_version", "olt", "pon_port"];
  }
  if (widget.binding === "telemetry.dailyMetrics") {
    return [
      "day",
      "serial",
      "mem_min_pct",
      "reboot_count",
      "optical_rx_min_dbm",
    ];
  }
  return ["ts", "serial", "state", "download_mbps", "upload_mbps"];
}

const labels: Record<string, string> = {
  customer_id: "Cliente",
  city: "Cidade",
  neighborhood: "Bairro",
  plan_mbps: "Plano",
  status: "Status",
  serial: "Serial",
  vendor: "Fabricante",
  model: "Modelo",
  software_version: "Firmware",
  olt: "OLT",
  pon_port: "PON",
  day: "Dia",
  mem_min_pct: "Memória mín.",
  reboot_count: "Reinícios",
  optical_rx_min_dbm: "Rx mín.",
  ts: "Data",
  state: "Estado",
  download_mbps: "Download",
  upload_mbps: "Upload",
};

function tableValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "number" ? number.format(value) : String(value);
}

export function TableWidget({
  widget,
  data,
  filters,
  onDrilldown,
}: {
  widget: DashboardWidget;
  data: DashboardRuntimeData;
  filters: InventoryFilter[];
  onDrilldown: Drilldown;
}) {
  const keys = columns(widget);
  type TableSort = `${string}:asc` | `${string}:desc`;
  const [sort, setSort] = useState<TableSort | "">("");
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const dateKey = keys.find((key) => ["day", "ts", "opened_at"].includes(key));
  const filterKeys: Record<InventoryFilter["kind"], string> = {
    customer: "customer_id",
    serial: "serial",
    vendor: "vendor",
    model: "model",
    firmware: "software_version",
    plan: "plan_mbps",
    olt: "olt",
    cto: "cto",
    city: "city",
    neighborhood: "neighborhood",
  };
  const rows = useMemo(() => {
    const [sortKey, direction] = sort.split(":");
    return (tableSource(widget, data) as Array<Record<string, unknown>>)
      .filter(
        (row) =>
          filters.every(
            (filter) =>
              String(row[filterKeys[filter.kind]] ?? "") === filter.value,
          ) &&
          (!dateKey ||
            ((!range.from || String(row[dateKey] ?? "") >= range.from) &&
              (!range.to ||
                String(row[dateKey] ?? "").slice(0, 10) <= range.to))),
      )
      .sort((left, right) => {
        if (!sortKey || !direction) return 0;
        const leftValue = left[sortKey];
        const rightValue = right[sortKey];
        if (leftValue == null) return 1;
        if (rightValue == null) return -1;
        const comparison =
          typeof leftValue === "number" && typeof rightValue === "number"
            ? leftValue - rightValue
            : String(leftValue).localeCompare(String(rightValue), "pt-BR", {
                numeric: true,
                sensitivity: "base",
              });
        return direction === "desc" ? -comparison : comparison;
      })
      .slice(0, widget.config?.limit ?? 5);
  }, [data, dateKey, filters, range, sort, widget]);
  return (
    <article className={`ai-dashboard-widget generic-table ${widget.tone}`}>
      <Heading widget={widget} icon={<List size={21} />} />
      {dateKey && <DateRangeFilter value={range} onChange={setRange} />}
      <div className="ai-table-scroll">
        <table>
          <thead>
            <tr>
              {keys.map((key) => (
                <SortableHeader
                  key={key}
                  label={labels[key] ?? key}
                  ascending={`${key}:asc` as TableSort}
                  descending={`${key}:desc` as TableSort}
                  current={sort as TableSort}
                  onChange={setSort}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={String(row.serial ?? row.customer_id ?? index)}
                onClick={() =>
                  onDrilldown({
                    kind: "table",
                    title: widget.title,
                    binding: widget.binding,
                    value: row,
                  })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onDrilldown({
                      kind: "table",
                      title: widget.title,
                      binding: widget.binding,
                      value: row,
                    });
                  }
                }}
                tabIndex={0}
              >
                {keys.map((key) => (
                  <td key={key}>{tableValue(row[key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div className="ai-widget-empty">
          Nenhum registro corresponde aos filtros.
        </div>
      )}
    </article>
  );
}

export function TopologyWidget({
  widget,
  data,
  onDrilldown,
}: {
  widget: DashboardWidget;
  data: DashboardRuntimeData;
  onDrilldown: Drilldown;
}) {
  return (
    <article className={`ai-dashboard-widget topology-widget ${widget.tone}`}>
      <Heading widget={widget} icon={<Network size={21} />} />
      <div className="ai-topology-flow">
        <button
          type="button"
          onClick={() =>
            onDrilldown({ kind: "park", value: data.topology.totals })
          }
        >
          <Network size={18} />
          <strong>Rede</strong>
          <span>{number.format(data.topology.totals.cpes)} CPEs</span>
        </button>
        <i aria-hidden="true" />
        <div>
          {data.topology.olts.slice(0, widget.config?.limit ?? 5).map((olt) => (
            <button
              type="button"
              key={olt.olt}
              onClick={() =>
                onDrilldown({
                  kind: "network",
                  entity: { kind: "olt", data: olt },
                })
              }
            >
              <strong>{olt.olt}</strong>
              <span>
                {olt.pons} PONs · {olt.cpes} CPEs
              </span>
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

export function MapWidget({
  widget,
  data,
  onDrilldown,
}: {
  widget: DashboardWidget;
  data: DashboardRuntimeData;
  onDrilldown: Drilldown;
}) {
  const places = data.topology.olts.slice(0, widget.config?.limit ?? 5);
  return (
    <article className={`ai-dashboard-widget map-widget ${widget.tone}`}>
      <Heading widget={widget} icon={<Map size={21} />} />
      <div
        className="ai-network-map"
        aria-label="Distribuição territorial aproximada"
      >
        {places.map((olt, index) => (
          <button
            type="button"
            key={olt.olt}
            style={{
              left: `${14 + ((index * 23) % 72)}%`,
              top: `${18 + ((index * 31) % 60)}%`,
            }}
            onClick={() =>
              onDrilldown({
                kind: "network",
                entity: { kind: "olt", data: olt },
              })
            }
          >
            <span>{olt.cities[0] ?? "Região"}</span>
            <strong>{olt.olt}</strong>
            <small>{olt.cpes} CPEs</small>
          </button>
        ))}
      </div>
      <p className="ai-map-note">
        Posição esquemática; o dataset não contém coordenadas geográficas.
      </p>
    </article>
  );
}
