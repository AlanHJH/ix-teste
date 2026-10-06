import { FormEvent, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Gauge,
  Search,
  ServerCog,
  Wifi,
} from "lucide-react";
import { api } from "./api";
import { HelpTooltip } from "./HelpTooltip";
import { providerGlossary, TechnicalText } from "./ProviderGlossary";
import type { DiagnosticsPage } from "./types";

const number = new Intl.NumberFormat("pt-BR");

type Filters = { state: string; requestedBy: string };
const defaultFilters: Filters = { state: "all", requestedBy: "all" };

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

export function DiagnosticsDirectory({
  onOpenSupport,
}: {
  onOpenSupport: (customerId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<DiagnosticsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError("");
    api
      .diagnostics(submittedQuery, page, filters)
      .then((response) => {
        if (!canceled) setResult(response);
      })
      .catch((reason) => {
        if (!canceled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível carregar os diagnósticos",
          );
        }
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [submittedQuery, page, filters]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSubmittedQuery(query);
  }

  function changeFilter(name: keyof Filters, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [name]: value }));
  }

  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.limit))
    : 1;

  return (
    <section className="diagnostics-page">
      <section className="diagnostics-hero">
        <div>
          <span className="section-label">
            TR-143 · diagnostics.csv
            <HelpTooltip
              term="TR-143"
              description={providerGlossary.tr143.description}
            />
          </span>
          <h1>Diagnósticos de CPE.</h1>
          <p>
            Consulte as medições de download e upload executadas no equipamento,
            diferenciando testes concluídos de <TechnicalText text="timeout" />{" "}
            e ausência de resposta.
          </p>
        </div>
        <div className="diagnostics-source">
          <ServerCog size={20} />
          <span>Testes pela CPE</span>
        </div>
      </section>

      {result && (
        <section
          className="metrics-grid diagnostics-metrics"
          aria-label="Resumo dos diagnósticos filtrados"
        >
          <Metric
            icon={Activity}
            label="Diagnósticos"
            value={number.format(result.summary.total)}
            note="na seleção atual"
            tone="neutral"
          />
          <Metric
            icon={CheckCircle2}
            label="Concluídos"
            value={number.format(result.summary.completed)}
            note="medição retornada pela CPE"
            tone="money"
          />
          <Metric
            icon={AlertTriangle}
            label="Falhas"
            value={number.format(result.summary.errors)}
            note="timeout ou sem resposta"
            tone="danger"
          />
          <Metric
            icon={Gauge}
            label="Média de download"
            value={
              result.summary.avg_download_mbps == null
                ? "n/d"
                : `${result.summary.avg_download_mbps} Mbps`
            }
            note={
              result.summary.avg_upload_mbps == null
                ? "sem upload mensurável"
                : `${result.summary.avg_upload_mbps} Mbps de upload`
            }
            tone="warning"
            help={`Média das medições concluídas pelo TR-143. ${providerGlossary.tr143.description} Não mede todo o Wi-Fi do cliente.`}
          />
        </section>
      )}

      <section
        className="diagnostics-directory"
        aria-label="Lista de diagnósticos"
      >
        <header className="diagnostics-directory-heading">
          <div>
            <span className="section-label">Fila de medições</span>
            <h2>Localize um teste executado</h2>
          </div>
          {result && (
            <span>
              {number.format(result.total)} registros · página {result.page} de{" "}
              {totalPages}
            </span>
          )}
        </header>

        <form className="diagnostics-search" onSubmit={submit}>
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Serial, cliente, fabricante ou modelo"
            aria-label="Pesquisar diagnósticos"
          />
          <button type="submit" disabled={loading}>
            {loading ? "Consultando…" : "Pesquisar"}
          </button>
        </form>

        <div className="diagnostics-filters">
          <Filter size={17} aria-hidden="true" />
          <label>
            Estado do teste
            <select
              value={filters.state}
              onChange={(event) => changeFilter("state", event.target.value)}
            >
              <option value="all">Todos</option>
              {result?.filters.states.map((state) => (
                <option key={state} value={state}>
                  {state === "Completed" ? "Concluído" : state}
                </option>
              ))}
            </select>
          </label>
          <label>
            Solicitado por
            <select
              value={filters.requestedBy}
              onChange={(event) =>
                changeFilter("requestedBy", event.target.value)
              }
            >
              <option value="all">Todos</option>
              {result?.filters.requested_by.map((requestedBy) => (
                <option key={requestedBy} value={requestedBy}>
                  {requestedBy}
                </option>
              ))}
            </select>
          </label>
          {(submittedQuery ||
            Object.values(filters).some((value) => value !== "all")) && (
            <button
              type="button"
              className="diagnostics-clear"
              onClick={() => {
                setQuery("");
                setSubmittedQuery("");
                setFilters(defaultFilters);
                setPage(1);
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>

        {error && <p className="diagnostics-error">{error}</p>}

        <div className="diagnostics-table-wrap">
          <table className="diagnostics-table">
            <thead>
              <tr>
                <th>Execução</th>
                <th>
                  CPE e cliente
                  <HelpTooltip
                    term="CPE"
                    description={`${providerGlossary.cpe.description} ${providerGlossary.serial.description}`}
                  />
                </th>
                <th>Resultado</th>
                <th>
                  Velocidade medida
                  <HelpTooltip
                    term="Download e upload"
                    description={`${providerGlossary.tr143.description} ${providerGlossary.mbps.description}`}
                  />
                </th>
                <th>
                  Rede
                  <HelpTooltip
                    term="OLT, PON e CTO"
                    description={`${providerGlossary.olt.description} ${providerGlossary.pon.description} ${providerGlossary.cto.description}`}
                  />
                </th>
                <th aria-label="Abrir atendimento" />
              </tr>
            </thead>
            <tbody>
              {result?.items.map((item) => (
                <tr key={`${item.serial}-${item.ts}`}>
                  <td>
                    <strong>{formatTimestamp(item.ts)}</strong>
                    <small>{item.requested_by}</small>
                  </td>
                  <td>
                    <code>{item.serial}</code>
                    <strong>
                      {item.vendor && item.model
                        ? `${item.vendor} ${item.model}`
                        : "Equipamento fora do inventário"}
                    </strong>
                    {item.customer_id && (
                      <button
                        type="button"
                        className="diagnostic-customer"
                        onClick={() => onOpenSupport(item.customer_id ?? "")}
                      >
                        {item.customer_id}
                      </button>
                    )}
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
                  <td>
                    {item.customer_id && (
                      <button
                        type="button"
                        className="diagnostic-open-support"
                        title="Abre o roteiro do atendimento N1 para este cliente."
                        onClick={() => onOpenSupport(item.customer_id ?? "")}
                      >
                        Abrir no N1
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && result?.items.length === 0 && (
            <div className="diagnostics-empty">
              <Wifi size={30} />
              <p>Nenhum diagnóstico corresponde aos filtros atuais.</p>
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
    </section>
  );
}
