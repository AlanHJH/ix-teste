import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  UserRound,
  Wifi,
} from "lucide-react";
import { api } from "./api";
import { CustomerDetailDrawer } from "./CustomerDetailDrawer";
import { FacetFilterSelect } from "./FacetFilterSelect";
import type {
  CustomerSummary,
  CustomerSummaryPage,
  InventoryFilter,
  InventoryFilterOption,
} from "./types";

type CustomerStatus = "active" | "cancelled" | "all";

const number = new Intl.NumberFormat("pt-BR");

const firstNames = [
  "Ana Beatriz",
  "Bruno",
  "Camila",
  "Daniel",
  "Elisa",
  "Felipe",
  "Gabriela",
  "Henrique",
  "Isabela",
  "João",
  "Larissa",
  "Marcelo",
  "Natália",
  "Otávio",
  "Paula",
  "Rafael",
  "Sabrina",
  "Tiago",
  "Valentina",
  "Vinícius",
];

const familyNames = [
  "Almeida",
  "Barros",
  "Castro",
  "Dias",
  "Farias",
  "Gomes",
  "Mendes",
  "Nogueira",
  "Pereira",
  "Ramos",
  "Tavares",
  "Vieira",
];

function hash(value: string) {
  let result = 0;
  for (const character of value) {
    result = (result * 31 + character.charCodeAt(0)) >>> 0;
  }
  return result;
}

function fictitiousName(customer: CustomerSummary) {
  const seed = hash(
    `${customer.customer_id}:${customer.city}:${customer.neighborhood}`,
  );
  const firstName = firstNames[seed % firstNames.length];
  const lastName = familyNames[Math.floor(seed / 17) % familyNames.length];
  const secondLastNameIndex = Math.floor(seed / 29) % familyNames.length;
  const secondLastName =
    familyNames[
      (secondLastNameIndex +
        (familyNames[secondLastNameIndex] === lastName ? 1 : 0)) %
        familyNames.length
    ];
  return `${firstName} ${lastName} ${secondLastName}`;
}

function displayDate(value: string) {
  if (!value) return "—";
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
}

const statusLabels: Record<CustomerStatus, string> = {
  active: "Ativos",
  cancelled: "Cancelados",
  all: "Todos",
};

export function CustomersDirectory({
  canOpenSupport,
  onOpenSupport,
}: {
  canOpenSupport: boolean;
  onOpenSupport: (customerId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [filters, setFilters] = useState<InventoryFilter[]>([]);
  const [status, setStatus] = useState<CustomerStatus>("active");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CustomerSummaryPage | null>(null);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void api
      .customerSearch(submittedQuery, page, status, filters)
      .then((nextData) => {
        if (!cancelled) setData(nextData);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível carregar a lista de clientes",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, page, status, submittedQuery]);

  const loadCustomerOptions = useCallback(
    (search: string): Promise<InventoryFilterOption[]> => {
      const inventoryStatus =
        status === "cancelled"
          ? "removed"
          : status === "all"
            ? "all"
            : "active";
      return api
        .inventoryFilterOptions(search, inventoryStatus)
        .then((options) =>
          options.filter((option) =>
            ["customer", "city", "neighborhood"].includes(option.kind),
          ),
        );
    },
    [status],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSubmittedQuery(query.trim());
  }

  function chooseStatus(nextStatus: CustomerStatus) {
    setStatus(nextStatus);
    setPage(1);
    setFilters([]);
  }

  function chooseFilters(nextFilters: InventoryFilter[]) {
    setFilters(nextFilters);
    setPage(1);
  }

  const firstItem =
    data && data.totalItems > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const lastItem = data
    ? Math.min(data.page * data.pageSize, data.totalItems)
    : 0;
  const localityCount = data
    ? new Set(data.data.map((item) => `${item.city}:${item.neighborhood}`)).size
    : 0;

  return (
    <section className="customers-page">
      <section className="customers-summary" aria-label="Resumo dos clientes">
        <article>
          <span>
            <UserRound size={16} /> Clientes encontrados
          </span>
          <strong>{data ? number.format(data.totalItems) : "—"}</strong>
        </article>
        <article>
          <span>
            <MapPin size={16} /> Localidades nesta página
          </span>
          <strong>{data ? number.format(localityCount) : "—"}</strong>
        </article>
        <article>
          <span>
            <Wifi size={16} /> Situação exibida
          </span>
          <strong>{statusLabels[status]}</strong>
        </article>
      </section>

      <section className="customers-directory">
        <div className="customers-toolbar">
          <form
            className="customers-search customers-search--faceted"
            onSubmit={submit}
          >
            <FacetFilterSelect<InventoryFilter, InventoryFilterOption>
              filters={filters}
              onChange={chooseFilters}
              query={query}
              onQueryChange={setQuery}
              loadOptions={loadCustomerOptions}
              placeholder="Buscar por código ou localidade"
              ariaLabel="Buscar clientes por código ou localidade"
              optionsId="customer-search-options"
              showClear
            />
            <button type="submit">Buscar</button>
          </form>
          <div
            className="customers-status"
            aria-label="Filtrar clientes por situação"
          >
            {(["active", "cancelled", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={status === value ? "active" : ""}
                onClick={() => chooseStatus(value)}
              >
                {statusLabels[value]}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="customers-error">{error}</p>}
        <div className="customers-table-wrap">
          <table className="customers-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Localidade</th>
                <th>Plano</th>
                <th>Desde</th>
                <th>Situação</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((customer) => {
                const name = fictitiousName(customer);
                const isActive = customer.customer_status === "active";
                return (
                  <tr key={customer.customer_id}>
                    <td>
                      <div className="customer-name-cell">
                        <span
                          className="customer-name-avatar"
                          aria-hidden="true"
                        >
                          {name
                            .split(" ")
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join("")}
                        </span>
                        <span>
                          <strong>{name}</strong>
                          <small>{customer.customer_id} · nome fictício</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="customer-location-cell">
                        <MapPin size={15} />
                        <span>
                          <strong>{customer.neighborhood}</strong>
                          <small>{customer.city}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      {customer.plan_mbps ? `${customer.plan_mbps} Mbps` : "—"}
                    </td>
                    <td>{displayDate(customer.customer_since)}</td>
                    <td>
                      <span
                        className={`customer-status-badge ${isActive ? "active" : "cancelled"}`}
                      >
                        {isActive ? "Ativo" : "Cancelado"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="customer-open-action"
                        onClick={() => setSelectedCustomer(customer)}
                      >
                        Abrir cliente
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && data?.data.length === 0 && (
                <tr>
                  <td className="customers-empty" colSpan={6}>
                    Nenhum cliente encontrado. Tente outro código ou localidade.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td className="customers-empty" colSpan={6}>
                    Carregando clientes…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="customers-pagination">
          <span>
            {data
              ? `Exibindo ${number.format(firstItem)}–${number.format(lastItem)} de ${number.format(data.totalItems)} clientes`
              : "Carregando clientes…"}
          </span>
          <div>
            <button
              type="button"
              disabled={loading || page === 1}
              onClick={() => setPage((current) => current - 1)}
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            <strong>Página {page}</strong>
            <button
              type="button"
              disabled={loading || !data || page >= data.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Próxima <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      </section>

      {selectedCustomer && (
        <CustomerDetailDrawer
          customer={selectedCustomer}
          displayName={fictitiousName(selectedCustomer)}
          canOpenSupport={canOpenSupport}
          onOpenSupport={(customerId) => {
            setSelectedCustomer(null);
            onOpenSupport(customerId);
          }}
          onClose={() => setSelectedCustomer(null)}
        />
      )}

      <p className="customers-source-note">
        <CheckCircle2 size={15} /> Localidade, plano e situação são consultados
        no cadastro consolidado de clientes; somente o nome é criado para a
        demonstração.
      </p>
    </section>
  );
}
