import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Headphones,
  MessageSquare,
  Network,
  TicketCheck,
  Wrench,
} from "lucide-react";
import { api } from "./api";
import { DateRangeFilter, type DateRange } from "./DateRangeFilter";
import { HelpTooltip } from "./HelpTooltip";
import {
  InventoryContextModal,
  type InventoryContext,
} from "./InventoryContextModal";
import { providerGlossary } from "./ProviderGlossary";
import { TicketFilterSelect } from "./TicketFilterSelect";
import { SortableHeader } from "./SortableHeader";
import type {
  SupportTicket,
  TicketFilter,
  TicketPage,
  TicketSort,
} from "./types";

const number = new Intl.NumberFormat("pt-BR");

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
  onOpenTicket,
  preset,
}: {
  onOpenSupport: (customerId: string) => void;
  onOpenTicket: (ticket: SupportTicket) => void;
  preset?: { key: number; filters: TicketFilter[] } | null;
}) {
  const [filters, setFilters] = useState<TicketFilter[]>([]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<TicketSort>("opened_at_desc");
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const [result, setResult] = useState<TicketPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customerModal, setCustomerModal] = useState<InventoryContext | null>(
    null,
  );
  const [customerLoadingId, setCustomerLoadingId] = useState("");
  const customerRequest = useRef(0);
  const presetApplied = useRef(false);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError("");
    api
      .tickets("", page, filters, sort, range)
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
  }, [page, filters, sort, range]);

  useEffect(() => {
    if (!preset) {
      if (!presetApplied.current) return;
      presetApplied.current = false;
      setFilters([]);
      setSort("opened_at_desc");
      setRange({ from: "", to: "" });
      setPage(1);
      return;
    }
    presetApplied.current = true;
    setFilters(preset.filters);
    setSort("noc_priority_desc");
    setRange({ from: "", to: "" });
    setPage(1);
  }, [preset]);

  async function openCustomer(customerId: string) {
    const request = ++customerRequest.current;
    setCustomerLoadingId(customerId);
    setError("");
    try {
      const inventory = await api.inventory("", 1, "all", [
        {
          kind: "customer",
          value: customerId,
          label: customerId,
          detail: "Cliente",
        },
      ]);
      if (request !== customerRequest.current) return;
      const item =
        inventory.data.find((entry) => entry.status === "active") ??
        inventory.data[0];
      if (!item) {
        setError(`O cliente ${customerId} não foi localizado no inventário.`);
        return;
      }
      setCustomerModal({ kind: "customer", item });
    } catch (reason) {
      if (request !== customerRequest.current) return;
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar os dados do cliente.",
      );
    } finally {
      if (request === customerRequest.current) setCustomerLoadingId("");
    }
  }

  const totalPages = result ? Math.max(1, result.totalPages) : 1;

  return (
    <section className="tickets-page">
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

        <div className="tickets-search">
          <TicketFilterSelect
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

        {error && <p className="tickets-error">{error}</p>}

        <div className="tickets-table-wrap">
          <table className="tickets-table">
            <thead>
              <tr>
                <SortableHeader
                  label="Ticket"
                  ascending="opened_at_asc"
                  descending="opened_at_desc"
                  current={sort}
                  onChange={(nextSort) => {
                    setSort(nextSort);
                    setPage(1);
                  }}
                />
                <SortableHeader
                  label="Cliente e origem"
                  ascending="customer_id_asc"
                  descending="customer_id_desc"
                  current={sort}
                  onChange={(nextSort) => {
                    setSort(nextSort);
                    setPage(1);
                  }}
                />
                <SortableHeader
                  label="Motivo relatado"
                  ascending="category_asc"
                  descending="category_desc"
                  current={sort}
                  onChange={(nextSort) => {
                    setSort(nextSort);
                    setPage(1);
                  }}
                >
                  <HelpTooltip
                    term="Termos técnicos"
                    description="Wi-Fi é a rede sem fio; OLT concentra a rede óptica; PON é a porta compartilhada; CTO distribui a fibra; CPE é o equipamento do cliente."
                  />
                </SortableHeader>
                <SortableHeader
                  label="Resolução"
                  ascending="resolution_asc"
                  descending="resolution_desc"
                  current={sort}
                  onChange={(nextSort) => {
                    setSort(nextSort);
                    setPage(1);
                  }}
                />
                <SortableHeader
                  label="Tempo"
                  ascending="handling_minutes_asc"
                  descending="handling_minutes_desc"
                  current={sort}
                  onChange={(nextSort) => {
                    setSort(nextSort);
                    setPage(1);
                  }}
                />
              </tr>
            </thead>
            <tbody>
              {result?.data.map((ticket) => (
                <tr
                  key={ticket.ticket_id}
                  className={
                    ["pending", "in_progress"].includes(ticket.noc_status)
                      ? "ticket-row-noc"
                      : undefined
                  }
                >
                  <td>
                    <button
                      type="button"
                      className="ticket-id-action"
                      onClick={() => onOpenTicket(ticket)}
                      title={`Abrir a ficha completa do ticket ${ticket.ticket_id}`}
                    >
                      <strong>{ticket.ticket_id}</strong>
                      <small>{formatOpenedAt(ticket.opened_at)}</small>
                      {ticket.source === "n1" && (
                        <span className="ticket-source-n1">
                          Aberto pelo N1
                          {ticket.opened_by ? ` · ${ticket.opened_by}` : ""}
                        </span>
                      )}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ticket-customer"
                      onClick={() => void openCustomer(ticket.customer_id)}
                      disabled={customerLoadingId === ticket.customer_id}
                      title="Ver informações gerais do cliente"
                    >
                      {customerLoadingId === ticket.customer_id
                        ? "Carregando…"
                        : ticket.customer_id}
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
                    {["pending", "in_progress"].includes(ticket.noc_status) && (
                      <span className="ticket-noc-badge">
                        <i aria-hidden="true" />
                        {ticket.noc_status === "pending"
                          ? "Aguardando NOC"
                          : "Em análise pelo NOC"}
                      </span>
                    )}
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

      {customerModal && (
        <InventoryContextModal
          context={customerModal}
          canOpenSupport
          onOpenSupport={onOpenSupport}
          onClose={() => setCustomerModal(null)}
        />
      )}
    </section>
  );
}
