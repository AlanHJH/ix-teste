import {
  Activity,
  BarChart3,
  Boxes,
  Gauge,
  Network,
  Users,
} from "lucide-react";
import { EntityDetailModal } from "./EntityDetailModal";
import type { EntityDetailItem } from "./EntityDetailModal";
import { NetworkEntityModal } from "./NetworkEntityModal";
import type { NetworkEntity } from "./NetworkEntityModal";
import type { DashboardBinding, TopologySnapshot } from "./types";

type DetailRecord = Record<string, unknown>;

export type DashboardDrilldown =
  | { kind: "network"; entity: NetworkEntity }
  | { kind: "park"; value: TopologySnapshot["totals"] }
  | {
      kind: "chart";
      title: string;
      binding: DashboardBinding;
      value: DetailRecord[];
    }
  | {
      kind: "table";
      title: string;
      binding: DashboardBinding;
      value: DetailRecord;
    };

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function text(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "number" ? number.format(value) : String(value);
}

function detail(label: string, value: unknown): EntityDetailItem {
  return { label, value: text(value) };
}

function route(record: DetailRecord) {
  return [record.olt, record.pon_port ?? record.pon, record.cto]
    .filter(Boolean)
    .join(" · ");
}

function recordPresentation(
  drilldown: Extract<DashboardDrilldown, { kind: "table" }>,
) {
  const record = drilldown.value;

  if (drilldown.binding === "inventory.customers") {
    return {
      variant: "customer",
      icon: <Users size={22} />,
      eyebrow: "Cliente do inventário",
      title: text(record.customer_id),
      subtitle: `${text(record.neighborhood)} · ${text(record.city)}`,
      details: [
        detail("Equipamento", `${text(record.vendor)} ${text(record.model)}`),
        detail("Serial", record.serial),
        detail("Plano contratado", `${text(record.plan_mbps)} Mbps`),
        detail("Status", record.status),
        detail("Firmware", record.software_version),
        detail("Caminho", route(record)),
        detail("Instalado em", record.installed_at),
        detail("Plano desde", record.plan_since),
      ],
    };
  }

  if (drilldown.binding === "inventory.equipment") {
    return {
      variant: "equipment",
      icon: <Boxes size={22} />,
      eyebrow: "Equipamento do cliente",
      title: text(record.serial),
      subtitle: `${text(record.vendor)} ${text(record.model)} · Cliente ${text(record.customer_id)}`,
      details: [
        detail("Revisão de hardware", record.hw_revision),
        detail("Firmware", record.software_version),
        detail("Plano contratado", `${text(record.plan_mbps)} Mbps`),
        detail("Status", record.status),
        detail("Caminho", route(record)),
        detail(
          "Localidade",
          `${text(record.neighborhood)} · ${text(record.city)}`,
        ),
      ],
    };
  }

  if (drilldown.binding === "telemetry.dailyMetrics") {
    return {
      variant: "telemetry",
      icon: <Activity size={22} />,
      eyebrow: "Telemetria diária",
      title: text(record.serial),
      subtitle: `${text(record.day)} · Cliente ${text(record.customer_id)}`,
      details: [
        detail("Equipamento", `${text(record.vendor)} ${text(record.model)}`),
        detail("Firmware", record.software_version),
        detail("Memória mínima", `${text(record.mem_min_pct)}%`),
        detail("Reinícios", record.reboot_count),
        detail("Erros FEC", record.fec_errors),
        detail("Potência RX mínima", `${text(record.optical_rx_min_dbm)} dBm`),
        detail("Informes recebidos", record.inform_count),
        detail("Caminho", route(record)),
      ],
    };
  }

  return {
    variant: "diagnostic",
    icon: <Gauge size={22} />,
    eyebrow: "Diagnóstico de conexão",
    title: text(record.serial),
    subtitle: `${text(record.ts)} · ${text(record.state)}`,
    details: [
      detail("Cliente", record.customer_id),
      detail("Diagnóstico", record.diagnostic),
      detail("Solicitado por", record.requested_by),
      detail("Download", `${text(record.download_mbps)} Mbps`),
      detail("Upload", `${text(record.upload_mbps)} Mbps`),
      detail("Servidor de teste", record.test_server),
      detail("Equipamento", `${text(record.vendor)} ${text(record.model)}`),
      detail("Caminho", route(record)),
    ],
  };
}

function ChartRows({ rows }: { rows: DetailRecord[] }) {
  const weekly = rows.some((row) => "week" in row);
  return (
    <div className="entity-modal-series">
      <span>{weekly ? "Série completa" : "Composição"}</span>
      <div className="entity-modal-series-scroll">
        <table>
          <thead>
            <tr>
              {(weekly
                ? ["Período", "Total", "Lentidão", "Sem conexão", "Wi-Fi"]
                : ["Categoria", "Quantidade"]
              ).map((label) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={String(row.week ?? row.name ?? index)}>
                {(weekly
                  ? [
                      row.week,
                      row.total,
                      row.slowness,
                      row.disconnected,
                      row.wifi,
                    ]
                  : [row.name, row.value]
                ).map((value, column) => (
                  <td key={column}>{text(value)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DashboardDetailModal({
  drilldown,
  onClose,
}: {
  drilldown: DashboardDrilldown;
  onClose: () => void;
}) {
  if (drilldown.kind === "network") {
    return <NetworkEntityModal entity={drilldown.entity} onClose={onClose} />;
  }

  if (drilldown.kind === "park") {
    return (
      <EntityDetailModal
        variant="park"
        icon={<Network size={22} />}
        eyebrow="Infraestrutura consolidada"
        title="Parque de rede"
        subtitle="Visão geral da topologia disponível"
        details={[
          detail("OLTs", drilldown.value.olts),
          detail("Portas PON", drilldown.value.pons),
          detail("CTOs", drilldown.value.ctos),
          detail("CPEs", drilldown.value.cpes),
        ]}
        onClose={onClose}
      />
    );
  }

  if (drilldown.kind === "table") {
    const presentation = recordPresentation(drilldown);
    return (
      <EntityDetailModal
        {...presentation}
        note="Dados carregados pela API REST; o registro operacional não é enviado ao modelo de IA."
        onClose={onClose}
      />
    );
  }

  const weekly = drilldown.value.some((row) => "week" in row);
  const totals = weekly
    ? drilldown.value.reduce((sum, row) => sum + Number(row.total ?? 0), 0)
    : drilldown.value.reduce((sum, row) => sum + Number(row.value ?? 0), 0);
  const largest = [...drilldown.value].sort(
    (left, right) =>
      Number(right.total ?? right.value ?? 0) -
      Number(left.total ?? left.value ?? 0),
  )[0];

  return (
    <EntityDetailModal
      variant="chart"
      icon={<BarChart3 size={22} />}
      eyebrow={weekly ? "Série temporal" : "Distribuição consolidada"}
      title={drilldown.title}
      subtitle={`${drilldown.value.length} ${weekly ? "períodos" : "categorias"} disponíveis`}
      details={[
        detail("Total", totals),
        detail(
          weekly ? "Maior período" : "Maior categoria",
          largest ? (largest.week ?? largest.name) : "—",
        ),
      ]}
      onClose={onClose}
    >
      <ChartRows rows={drilldown.value} />
    </EntityDetailModal>
  );
}
