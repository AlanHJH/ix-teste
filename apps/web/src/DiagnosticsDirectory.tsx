import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Wifi,
} from "lucide-react";
import { api } from "./api";
import { DateRangeFilter, type DateRange } from "./DateRangeFilter";
import { DiagnosticFilterSelect } from "./DiagnosticFilterSelect";
import { HelpTooltip } from "./HelpTooltip";
import {
  InventoryContextModal,
  type InventoryContext,
} from "./InventoryContextModal";
import { providerGlossary } from "./ProviderGlossary";
import { SortableHeader } from "./SortableHeader";
import type {
  DiagnosticFilter,
  DiagnosticsPage,
  DiagnosticSort,
} from "./types";

const number = new Intl.NumberFormat("pt-BR");

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Metric({
  icon: Icon,
  label,
  value,
  note,
  tone,
  help,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  note: string;
  tone: "neutral" | "warning" | "danger" | "money";
  help?: string;
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-icon">
        <Icon size={19} />
      </div>
      <div>
        <span>
          {label}
          {help && <HelpTooltip term={label} description={help} />}
        </span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

export function DiagnosticsDirectory() {
  const [filters, setFilters] = useState<DiagnosticFilter[]>([]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<DiagnosticSort>("ts_desc");
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const [result, setResult] = useState<DiagnosticsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [contextModal, setContextModal] = useState<InventoryContext | null>(
    null,
  );
  const [equipmentLoading, setEquipmentLoading] = useState("");
  const equipmentRequest = useRef(0);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError("");
    api
      .diagnostics("", page, filters, sort, range)
      .then((response) => {
        if (!canceled) setResult(response);
      })
      .catch((reason) => {
        if (!canceled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível carregar as medições",
          );
        }
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [page, filters, sort, range]);

  async function openEquipment(serial: string) {
    const request = ++equipmentRequest.current;
    setEquipmentLoading(serial);
    setError("");
    try {
      const inventory = await api.inventory("", 1, "all", [
        { kind: "serial", value: serial, label: serial, detail: "CPE" },
      ]);
      if (request !== equipmentRequest.current) return;
      const item = inventory.data[0];
      if (!item) {
        setError(`A CPE ${serial} não foi localizada no inventário.`);
        return;
      }
      setContextModal({ kind: "customer", item });
    } catch (reason) {
      if (request !== equipmentRequest.current) return;
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar os detalhes da CPE.",
      );
    } finally {
      if (request === equipmentRequest.current) setEquipmentLoading("");
    }
  }

  const totalPages = result ? Math.max(1, result.totalPages) : 1;

  return (
    <section className="diagnostics-page">
      {result && (
        <section
          className="metrics-grid diagnostics-metrics"
          aria-label="Resumo das medições filtradas"
        >
          <Metric
            icon={Activity}
            label="Medições"
            value={number.format(result.meta.summary.total)}
            note="na seleção atual"
            tone="neutral"
          />
          <Metric
            icon={CheckCircle2}
            label="Concluídos"
            value={number.format(result.meta.summary.completed)}
            note="medição retornada pela CPE"
            tone="money"
          />
          <Metric
            icon={AlertTriangle}
            label="Falhas"
            value={number.format(result.meta.summary.errors)}
            note="timeout ou sem resposta"
            tone="danger"
          />
          <Metric
            icon={Gauge}
            label="Média de download"
            value={
              result.meta.summary.avg_download_mbps == null
                ? "n/d"
                : `${result.meta.summary.avg_download_mbps} Mbps`
            }
            note={
              result.meta.summary.avg_upload_mbps == null
                ? "sem upload mensurável"
                : `${result.meta.summary.avg_upload_mbps} Mbps de upload`
            }
            tone="warning"
            help={`Média das medições concluídas pelo TR-143. ${providerGlossary.tr143.description} Não mede todo o Wi-Fi do cliente.`}
          />
        </section>
      )}

      <section className="diagnostics-directory" aria-label="Lista de medições">
        <header className="diagnostics-directory-heading">
          <div>
            <span className="section-label">Fila de medições</span>
            <h2>Localize um teste executado</h2>
          </div>
          {result && (
            <span>
              {number.format(result.totalItems)} registros · página{" "}
              {result.page} de {totalPages}
            </span>
          )}
        </header>

        <div className="diagnostics-facet-search">
          <DiagnosticFilterSelect
            filters={filters}
            onChange={(nextFilters) => {
              setFilters(nextFilters);
              setPage(1);
            }}
          />
        </div>

        <div className="directory-advanced-controls">
          <DateRangeFilter
            value={range}
            onChange={(nextRange) => {
              setRange(nextRange);
              setPage(1);
            }}
          />
        </div>

        {error && <p className="diagnostics-error">{error}</p>}

        <div className="diagnostics-table-wrap">
          <table className="diagnostics-table">
            <thead>
              <tr>
                <SortableHeader
                  label="Execução"
                  ascending="ts_asc"
                  descending="ts_desc"
                  current={sort}
                  onChange={(nextSort) => {
                    setSort(nextSort);
                    setPage(1);
                  }}
                />
                <SortableHeader
                  label="CPE e cliente"
                  ascending="serial_asc"
                  descending="serial_desc"
                  current={sort}
                  onChange={(nextSort) => {
                    setSort(nextSort);
                    setPage(1);
                  }}
                >
                  <HelpTooltip
                    term="CPE"
                    description={`${providerGlossary.cpe.description} ${providerGlossary.serial.description}`}
                  />
                </SortableHeader>
                <SortableHeader
                  label="Resultado"
                  ascending="state_asc"
                  descending="state_desc"
                  current={sort}
                  onChange={(nextSort) => {
                    setSort(nextSort);
                    setPage(1);
                  }}
                />
                <SortableHeader
                  label="Velocidade medida"
                  ascending="download_mbps_asc"
                  descending="download_mbps_desc"
                  current={sort}
                  onChange={(nextSort) => {
                    setSort(nextSort);
                    setPage(1);
                  }}
                >
                  <HelpTooltip
                    term="Download e upload"
                    description={`${providerGlossary.tr143.description} ${providerGlossary.mbps.description}`}
                  />
                </SortableHeader>
                <SortableHeader
                  label="Rede"
                  ascending="olt_asc"
                  descending="olt_desc"
                  current={sort}
                  onChange={(nextSort) => {
                    setSort(nextSort);
                    setPage(1);
                  }}
                >
                  <HelpTooltip
                    term="OLT, PON e CTO"
                    description={`${providerGlossary.olt.description} ${providerGlossary.pon.description} ${providerGlossary.cto.description}`}
                  />
                </SortableHeader>
              </tr>
            </thead>
            <tbody>
              {result?.data.map((item) => (
                <tr key={`${item.serial}-${item.ts}`}>
                  <td>
                    <strong>{formatTimestamp(item.ts)}</strong>
                    <small>{item.requested_by}</small>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="diagnostic-equipment-action"
                      onClick={() => void openEquipment(item.serial)}
                      disabled={equipmentLoading === item.serial}
                      title="Ver todos os detalhes da CPE e do cliente"
                    >
                      <code>{item.serial}</code>
                      <strong>
                        {equipmentLoading === item.serial
                          ? "Carregando…"
                          : item.vendor && item.model
                            ? `${item.vendor} ${item.model}`
                            : "Equipamento fora do inventário"}
                      </strong>
                      {item.customer_id && <span>{item.customer_id}</span>}
                    </button>
                  </td>
                  <td>
                    <span
                      className={`diagnostic-state ${item.state === "Completed" ? "completed" : "error"}`}
                    >
                      {item.state === "Completed" ? "Concluído" : item.state}
                    </span>
                    <small>{item.diagnostic}</small>
                  </td>
                  <td>
                    {item.state === "Completed" ? (
                      <>
                        <strong>{item.download_mbps ?? "n/d"} Mbps ↓</strong>
                        <small>{item.upload_mbps ?? "n/d"} Mbps ↑</small>
                        {item.plan_mbps && (
                          <span>Plano {item.plan_mbps} Mbps</span>
                        )}
                      </>
                    ) : (
                      <strong>Sem medição</strong>
                    )}
                  </td>
                  <td>
                    <strong>
                      {item.olt && item.pon
                        ? `${item.olt} · PON ${item.pon}`
                        : "n/d"}
                    </strong>
                    <small>
                      {item.cto ??
                        item.test_server ??
                        "Sem topologia associada"}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && result?.data.length === 0 && (
            <div className="diagnostics-empty">
              <Wifi size={30} />
              <p>Nenhuma medição corresponde aos filtros atuais.</p>
            </div>
          )}
        </div>

        {result && totalPages > 1 && (
          <footer className="diagnostics-pagination">
            <button
              type="button"
              disabled={page === 1 || loading}
              onClick={() => setPage((current) => current - 1)}
            >
              <ChevronLeft size={17} /> Anterior
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              disabled={page === totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              Próxima <ChevronRight size={17} />
            </button>
          </footer>
        )}
      </section>
      {contextModal && (
        <InventoryContextModal
          context={contextModal}
          canOpenSupport={false}
          showSupportAction={false}
          onOpenSupport={() => undefined}
          onClose={() => setContextModal(null)}
        />
      )}
    </section>
  );
}
