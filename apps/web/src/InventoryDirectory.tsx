import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Search,
  Server,
  X,
} from "lucide-react";
import { api } from "./api";
import { HelpTooltip } from "./HelpTooltip";
import {
  InventoryContextModal,
  type InventoryContext,
} from "./InventoryContextModal";
import { NetworkEntityModal } from "./NetworkEntityModal";
import type { NetworkEntity } from "./NetworkEntityModal";
import { providerGlossary, TechnicalText } from "./ProviderGlossary";
import type {
  EquipmentPath,
  InventoryFilter,
  InventoryFilterOption,
  InventoryPage,
  InventoryRecord,
  TopologySnapshot,
} from "./types";

const number = new Intl.NumberFormat("pt-BR");

type InventoryStatus = "active" | "removed" | "all";

const statusLabel = {
  active: "Ativo",
  removed: "Removido",
} as const;

export function InventoryDirectory({
  onOpenSupport,
  canOpenSupport,
}: {
  onOpenSupport: (customerId: string) => void;
  canOpenSupport: boolean;
}) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [status, setStatus] = useState<InventoryStatus>("active");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<InventoryPage | null>(null);
  const [topology, setTopology] = useState<TopologySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [topologyError, setTopologyError] = useState("");
  const [filters, setFilters] = useState<InventoryFilter[]>([]);
  const [filterOptions, setFilterOptions] = useState<InventoryFilterOption[]>(
    [],
  );
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [contextModal, setContextModal] = useState<InventoryContext | null>(
    null,
  );
  const [networkModal, setNetworkModal] = useState<NetworkEntity | null>(null);

  useEffect(() => {
    void load();
  }, [submittedQuery, page, status, filters]);

  useEffect(() => {
    if (!suggestionsOpen) return;
    const timeout = window.setTimeout(() => {
      setSuggestionsLoading(true);
      api
        .inventoryFilterOptions(query, status)
        .then(setFilterOptions)
        .catch(() => setFilterOptions([]))
        .finally(() => setSuggestionsLoading(false));
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [query, status, suggestionsOpen]);

  useEffect(() => {
    api
      .topology()
      .then(setTopology)
      .catch((reason) =>
        setTopologyError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível carregar as OLTs",
        ),
      );
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await api.inventory(submittedQuery, page, status, filters));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar o cadastro",
      );
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSubmittedQuery(query);
  }

  function chooseStatus(nextStatus: InventoryStatus) {
    setStatus(nextStatus);
    setPage(1);
  }

  function filterByOlt(olt: string) {
    const option = {
      kind: "olt" as const,
      value: olt,
      label: olt,
      detail: "OLT",
    };
    setFilters((current) => [
      ...current.filter((filter) => filter.kind !== "olt"),
      option,
    ]);
    setQuery("");
    setSubmittedQuery("");
    setStatus("active");
    setPage(1);
  }

  function selectFilter(option: InventoryFilterOption) {
    setFilters((current) =>
      current.some(
        (filter) =>
          filter.kind === option.kind && filter.value === option.value,
      )
        ? current
        : [...current, option],
    );
    setQuery("");
    setSubmittedQuery("");
    setSuggestionsOpen(false);
    setPage(1);
  }

  function removeFilter(filter: InventoryFilter) {
    setFilters((current) =>
      current.filter(
        (item) => !(item.kind === filter.kind && item.value === filter.value),
      ),
    );
    setPage(1);
  }

  function asEquipmentPath(item: InventoryRecord): EquipmentPath {
    return {
      serial: item.serial,
      customer_id: item.customer_id,
      vendor: item.vendor,
      model: item.model,
      hw_revision: item.hw_revision,
      software_version: item.software_version,
      plan_mbps: item.plan_mbps,
      olt: item.olt,
      pon: item.pon_port,
      cto: item.cto,
      city: item.city,
      neighborhood: item.neighborhood,
      logical_drop_id: null,
    };
  }

  function openEquipment(item: InventoryRecord) {
    setNetworkModal({ kind: "cpe", data: asEquipmentPath(item) });
  }

  async function openPon(item: InventoryRecord) {
    try {
      const branch = await api.topology(item.olt);
      const pon = branch.pons.find((entry) => entry.pon === item.pon_port);
      if (pon) setNetworkModal({ kind: "pon", olt: item.olt, data: pon });
    } catch {
      setTopologyError("Não foi possível carregar os detalhes desta PON.");
    }
  }

  async function openCto(item: InventoryRecord) {
    try {
      const branch = await api.topology(item.olt, item.pon_port);
      const cto = branch.ctos.find((entry) => entry.cto === item.cto);
      if (cto) {
        setNetworkModal({
          kind: "cto",
          olt: item.olt,
          pon: item.pon_port,
          data: cto,
        });
      }
    } catch {
      setTopologyError("Não foi possível carregar os detalhes desta CTO.");
    }
  }

  const visibleFilterOptions = useMemo(
    () =>
      filterOptions.filter(
        (option) =>
          !filters.some(
            (filter) =>
              filter.kind === option.kind && filter.value === option.value,
          ),
      ),
    [filterOptions, filters],
  );

  const firstItem = data
    ? data.totalItems === 0
      ? 0
      : (data.page - 1) * data.pageSize + 1
    : 0;
  const lastItem = data
    ? Math.min(data.page * data.pageSize, data.totalItems)
    : 0;
  const hasNextPage = data ? data.page < data.totalPages : false;

  return (
    <section className="inventory-page">
      <section
        className="inventory-olts"
        aria-labelledby="inventory-olts-title"
      >
        <header className="inventory-olts-heading">
          <div>
            <span className="section-label">Infraestrutura de acesso</span>
            <h2 id="inventory-olts-title">OLTs cadastradas</h2>
            <p>
              Cobertura e capacidade calculadas com base nas CPEs ativas do
              inventário.
            </p>
          </div>
          <div
            className="provider-glossary"
            aria-label="Ajuda da infraestrutura"
          >
            {(
              [
                ["OLT", providerGlossary.olt.description],
                ["PON", providerGlossary.pon.description],
                ["CTO", providerGlossary.cto.description],
                ["CPE", providerGlossary.cpe.description],
              ] as const
            ).map(([term, description]) => (
              <span key={term}>
                {term}
                <HelpTooltip term={term} description={description} />
              </span>
            ))}
          </div>
        </header>
        {topologyError && <p className="inventory-error">{topologyError}</p>}
        <div className="inventory-olts-grid">
          {topology?.olts.map((olt) => (
            <article className="inventory-olt-card" key={olt.olt}>
              <header>
                <span className="inventory-olt-icon">
                  <Server size={19} />
                </span>
                <div>
                  <strong>{olt.olt}</strong>
                  <small>{olt.cities.join(" · ")}</small>
                </div>
              </header>
              <dl>
                <div>
                  <dt>Portas PON</dt>
                  <dd>{number.format(olt.pons)}</dd>
                </div>
                <div>
                  <dt>CTOs</dt>
                  <dd>{number.format(olt.ctos)}</dd>
                </div>
                <div>
                  <dt>CPEs ativas</dt>
                  <dd>{number.format(olt.cpes)}</dd>
                </div>
                <div>
                  <dt>Bairros</dt>
                  <dd>{number.format(olt.neighborhoods.length)}</dd>
                </div>
              </dl>
              <button type="button" onClick={() => filterByOlt(olt.olt)}>
                Ver equipamentos
              </button>
            </article>
          ))}
          {!topology && !topologyError && (
            <p className="inventory-olts-loading">Carregando OLTs…</p>
          )}
        </div>
        <p className="inventory-olts-note">
          A fonte não inclui informações de <TechnicalText text="chassi" />,{" "}
          <TechnicalText text="uplink" /> ou estado em tempo real das{" "}
          <TechnicalText text="OLTs" />; esses campos não são inferidos nesta
          tela.
        </p>
      </section>

      <section className="inventory-panel">
        <div className="inventory-toolbar">
          <form
            className="inventory-search inventory-filter-search"
            onSubmit={submit}
            onFocus={() => setSuggestionsOpen(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setSuggestionsOpen(false);
              }
            }}
          >
            <div className="inventory-filter-input-row">
              <Search size={18} />
              <div className="inventory-filter-combobox">
                {filters.map((filter) => (
                  <span
                    className="inventory-filter-chip"
                    key={`${filter.kind}:${filter.value}`}
                  >
                    {filter.label}
                    <button
                      type="button"
                      onClick={() => removeFilter(filter)}
                      aria-label={`Remover filtro ${filter.label}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSuggestionsOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && suggestionsOpen) {
                      event.preventDefault();
                      event.stopPropagation();
                      setSuggestionsOpen(false);
                      return;
                    }
                    if (
                      event.key === "Enter" &&
                      visibleFilterOptions.length > 0 &&
                      query.trim()
                    ) {
                      event.preventDefault();
                      selectFilter(visibleFilterOptions[0]);
                    }
                  }}
                  placeholder={
                    filters.length > 0
                      ? "Adicionar outro filtro…"
                      : "Cliente, serial, modelo, firmware, plano, OLT, CTO ou localidade"
                  }
                  aria-label="Adicionar filtros ao inventário"
                  role="combobox"
                  aria-expanded={suggestionsOpen}
                  aria-controls="inventory-filter-options"
                  aria-autocomplete="list"
                />
              </div>
              {(filters.length > 0 || submittedQuery) && (
                <button
                  className="inventory-filter-clear"
                  type="button"
                  onClick={() => {
                    setFilters([]);
                    setQuery("");
                    setSubmittedQuery("");
                    setPage(1);
                  }}
                >
                  Limpar
                </button>
              )}
            </div>
            {suggestionsOpen && (
              <div
                className="inventory-filter-options"
                id="inventory-filter-options"
                role="listbox"
                aria-label="Sugestões de filtro"
              >
                {suggestionsLoading ? (
                  <p>Buscando opções…</p>
                ) : visibleFilterOptions.length > 0 ? (
                  visibleFilterOptions.map((option) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected="false"
                      key={`${option.kind}:${option.value}`}
                      onClick={() => selectFilter(option)}
                    >
                      <span>
                        <strong>{option.label}</strong>
                        <small>{option.detail}</small>
                      </span>
                      <span className="inventory-option-count">
                        {number.format(option.count)}
                      </span>
                    </button>
                  ))
                ) : (
                  <p>Nenhuma opção encontrada.</p>
                )}
                {query.trim() && (
                  <button className="inventory-free-search" type="submit">
                    <Search size={14} /> Buscar “{query.trim()}” em todos os
                    campos
                  </button>
                )}
              </div>
            )}
          </form>
          <div className="inventory-status" aria-label="Filtrar por situação">
            {(
              [
                ["active", "Ativos"],
                ["removed", "Removidos"],
                ["all", "Todos"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={status === value ? "active" : ""}
                onClick={() => chooseStatus(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="inventory-error">{error}</p>}
        <div className="inventory-table-wrap">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>
                  Serial da CPE
                  <HelpTooltip
                    term="CPE e serial"
                    description={`${providerGlossary.cpe.description} ${providerGlossary.serial.description}`}
                  />
                </th>
                <th>
                  Equipamento
                  <HelpTooltip
                    term="Revisão de hardware"
                    description={providerGlossary.hardware.description}
                  />
                </th>
                <th>
                  Firmware / plano
                  <HelpTooltip
                    term="Firmware"
                    description={providerGlossary.firmware.description}
                  />
                  <HelpTooltip
                    term="Plano"
                    description={`Velocidade contratada pelo cliente. ${providerGlossary.mbps.description}`}
                  />
                </th>
                <th>
                  Topologia
                  <HelpTooltip
                    term="OLT, PON e CTO"
                    description={`${providerGlossary.olt.description} ${providerGlossary.pon.description} ${providerGlossary.cto.description}`}
                  />
                </th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((item) => (
                <tr key={item.serial}>
                  <td>
                    <button
                      className="inventory-cell-action inventory-customer-cell"
                      type="button"
                      onClick={() =>
                        setContextModal({ kind: "customer", item })
                      }
                      title="Ver informações gerais do cliente"
                    >
                      <strong className="inventory-code">
                        {item.customer_id}
                      </strong>
                      <small>
                        <MapPin size={13} /> {item.neighborhood} · {item.city}
                      </small>
                    </button>
                  </td>
                  <td>
                    <button
                      className="inventory-cell-action"
                      type="button"
                      onClick={() => openEquipment(item)}
                      title="Ver detalhes desta CPE"
                    >
                      <code>{item.serial}</code>
                    </button>
                  </td>
                  <td>
                    <button
                      className="inventory-cell-action"
                      type="button"
                      onClick={() => openEquipment(item)}
                      title="Ver detalhes deste equipamento"
                    >
                      <strong>
                        {item.vendor} {item.model}
                      </strong>
                      <small>rev. {item.hw_revision}</small>
                    </button>
                  </td>
                  <td>
                    <div className="inventory-stacked-actions">
                      <button
                        type="button"
                        onClick={() =>
                          setContextModal({ kind: "firmware", item })
                        }
                      >
                        fw {item.software_version}
                      </button>
                      <button
                        type="button"
                        onClick={() => setContextModal({ kind: "plan", item })}
                      >
                        {item.plan_mbps} Mbps
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="inventory-topology-actions">
                      <Server size={14} />
                      <button
                        type="button"
                        onClick={() => {
                          const olt = topology?.olts.find(
                            (entry) => entry.olt === item.olt,
                          );
                          if (olt) setNetworkModal({ kind: "olt", data: olt });
                        }}
                      >
                        {item.olt}
                      </button>
                      <span>·</span>
                      <button type="button" onClick={() => void openPon(item)}>
                        PON {item.pon_port}
                      </button>
                      <button
                        className="inventory-cto-action"
                        type="button"
                        onClick={() => void openCto(item)}
                      >
                        {item.cto}
                      </button>
                    </div>
                  </td>
                  <td>
                    <span className={`inventory-badge ${item.status}`}>
                      {statusLabel[item.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && data?.data.length === 0 && (
                <tr>
                  <td className="inventory-empty" colSpan={6}>
                    Nenhum cadastro encontrado. Tente outro código, serial ou
                    filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="inventory-pagination">
          <span>
            {data
              ? `Exibindo ${number.format(firstItem)}–${number.format(lastItem)} de ${number.format(data.totalItems)} registros`
              : "Carregando registros…"}
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
              disabled={loading || !hasNextPage}
              onClick={() => setPage((current) => current + 1)}
            >
              Próxima <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      </section>

      {contextModal && (
        <InventoryContextModal
          context={contextModal}
          canOpenSupport={canOpenSupport}
          onOpenSupport={onOpenSupport}
          onClose={() => setContextModal(null)}
        />
      )}
      {networkModal && (
        <NetworkEntityModal
          entity={networkModal}
          onClose={() => setNetworkModal(null)}
        />
      )}
    </section>
  );
}
