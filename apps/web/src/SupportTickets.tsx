import { FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Headphones,
  MessageSquare,
  Network,
  Search,
  TicketCheck,
  Wrench,
} from "lucide-react";
import { api } from "./api";
import { HelpTooltip } from "./HelpTooltip";
import { providerGlossary } from "./ProviderGlossary";
import type { TicketPage } from "./types";

const number = new Intl.NumberFormat("pt-BR");

type Filters = {
  category: string;
  resolution: string;
  channel: string;
};

const defaultFilters: Filters = {
  category: "all",
  resolution: "all",
  channel: "all",
};

function formatOpenedAt(value: string) {
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
  icon: typeof TicketCheck;
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

export function SupportTickets({
  onOpenSupport,
}: {
  onOpenSupport: (customerId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<TicketPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError("");
    api
      .tickets(submittedQuery, page, filters)
      .then((response) => {
        if (!canceled) setResult(response);
      })
      .catch((reason) => {
        if (!canceled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível carregar os tickets",
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

  const totalPages = result ? Math.max(1, result.totalPages) : 1;

  return (
    <section className="tickets-page">
      <section className="tickets-hero">
        <div>
          <span className="section-label">
            Atendimento · chamados de clientes
            <HelpTooltip
              term="Ticket"
              description="Registro de um contato de suporte, com motivo, tratamento e resolução."
            />
          </span>
          <h1>Tickets de suporte.</h1>
          <p>
            Consulte os chamados individuais abertos pelo N1 e o histórico
            importado. Incidentes do NOC aparecem como vínculo quando explicam o
            problema de um cliente.
          </p>
        </div>
        <div className="tickets-source">
          <TicketCheck size={20} />
          <span>Histórico importado + chamados do N1</span>
        </div>
      </section>

      {result && (
        <section
          className="metrics-grid tickets-metrics"
          aria-label="Resumo dos tickets filtrados"
        >
          <Metric
            icon={TicketCheck}
            label="Tickets encontrados"
            value={number.format(result.meta.summary.total)}
            note="na seleção atual"
            tone="neutral"
          />
          <Metric
            icon={Wrench}
            label="Chamados técnicos"
            value={number.format(result.meta.summary.technical)}
            note="Lentidão, queda ou Wi‑Fi"
            tone="warning"
            help={providerGlossary.wifi.description}
          />
          <Metric
            icon={AlertTriangle}
            label="Escalados ao NOC"
            value={number.format(result.meta.summary.escalated)}
            note="exigem investigação de rede"
            tone="danger"
            help={`${providerGlossary.noc.description} Um ticket escalado requer investigação além do atendimento inicial.`}
          />
          <Metric
            icon={Clock3}
            label="Tempo médio"
            value={
              result.meta.summary.avg_handling_minutes == null
                ? "n/d"
                : `${result.meta.summary.avg_handling_minutes} min`
            }
            note="da abertura ao encerramento"
            tone="money"
          />
        </section>
      )}

      <section
        className="tickets-directory"
        aria-label="Lista de tickets de suporte"
      >
        <header className="tickets-directory-heading">
          <div>
            <span className="section-label">Fila consultável</span>
            <h2>Pesquise e filtre os chamados</h2>
          </div>
          {result && (
            <span>
              {number.format(result.totalItems)} registros · página{" "}
              {result.page} de {totalPages}
            </span>
          )}
        </header>

        <form className="tickets-search" onSubmit={submit}>
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ticket, cliente, descrição ou resolução"
            aria-label="Pesquisar tickets"
          />
          <button type="submit" disabled={loading}>
            {loading ? "Consultando…" : "Pesquisar"}
          </button>
        </form>

        <div className="tickets-filters">
          <Filter size={17} aria-hidden="true" />
          <label>
            Categoria
            <select
              value={filters.category}
              onChange={(event) => changeFilter("category", event.target.value)}
            >
              <option value="all">Todas</option>
              {result?.meta.filters.categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label>
            Resolução
            <select
              value={filters.resolution}
              onChange={(event) =>
                changeFilter("resolution", event.target.value)
              }
            >
              <option value="all">Todas</option>
              {result?.meta.filters.resolutions.map((resolution) => (
                <option key={resolution} value={resolution}>
                  {resolution}
                </option>
              ))}
            </select>
          </label>
          <label>
            Canal
            <select
              value={filters.channel}
              onChange={(event) => changeFilter("channel", event.target.value)}
            >
              <option value="all">Todos</option>
              {result?.meta.filters.channels.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </label>
          {(submittedQuery ||
            Object.values(filters).some((value) => value !== "all")) && (
            <button
              type="button"
              className="tickets-clear"
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

        {error && <p className="tickets-error">{error}</p>}

        <div className="tickets-table-wrap">
          <table className="tickets-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Cliente e origem</th>
                <th>
                  Motivo relatado
                  <HelpTooltip
                    term="Termos técnicos"
                    description="Wi-Fi é a rede sem fio; OLT concentra a rede óptica; PON é a porta compartilhada; CTO distribui a fibra; CPE é o equipamento do cliente."
                  />
                </th>
                <th>Resolução</th>
                <th>Tempo</th>
                <th aria-label="Abrir atendimento" />
              </tr>
            </thead>
            <tbody>
              {result?.data.map((ticket) => (
                <tr key={ticket.ticket_id}>
                  <td>
                    <strong>{ticket.ticket_id}</strong>
                    <small>{formatOpenedAt(ticket.opened_at)}</small>
                    {ticket.source === "n1" && (
                      <span className="ticket-source-n1">
                        Aberto pelo N1
                        {ticket.opened_by ? ` · ${ticket.opened_by}` : ""}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ticket-customer"
                      onClick={() => onOpenSupport(ticket.customer_id)}
                    >
                      {ticket.customer_id}
                    </button>
                    <small>
                      {ticket.neighborhood && ticket.city
                        ? `${ticket.neighborhood} · ${ticket.city}`
                        : "Sem CPE ativa no inventário"}
                    </small>
                    <span className="ticket-channel">
                      <MessageSquare size={13} /> {ticket.channel}
                    </span>
                  </td>
                  <td>
                    <span className="ticket-category">{ticket.category}</span>
                    <p>{ticket.description}</p>
                  </td>
                  <td>
                    <strong>{ticket.resolution}</strong>
                    {ticket.olt && ticket.pon && ticket.cto && (
                      <small>
                        {ticket.olt} · PON {ticket.pon} · {ticket.cto}
                      </small>
                    )}
                    {ticket.related_problem_id && (
                      <span className="ticket-incident-link">
                        <Network size={13} /> Incidente NOC ·{" "}
                        {ticket.related_problem_id}
                        <HelpTooltip
                          term="Incidente relacionado"
                          description="Este é um chamado individual vinculado a um problema compartilhado acompanhado pelo NOC."
                        />
                      </span>
                    )}
                  </td>
                  <td>
                    <strong>
                      {ticket.handling_minutes == null
                        ? "Em aberto"
                        : `${ticket.handling_minutes} min`}
                    </strong>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ticket-open-support"
                      title="Abre o roteiro do atendimento N1 para este cliente."
                      onClick={() => onOpenSupport(ticket.customer_id)}
                    >
                      Abrir no N1
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && result?.data.length === 0 && (
            <div className="tickets-empty">
              <Headphones size={30} />
              <p>Nenhum ticket corresponde aos filtros atuais.</p>
            </div>
          )}
        </div>

        {result && totalPages > 1 && (
          <footer className="tickets-pagination">
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
