import { FormEvent, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Server } from "lucide-react";
import { api } from "./api";
import { HelpTooltip } from "./HelpTooltip";
import {
  InventoryContextModal,
  type InventoryContext,
} from "./InventoryContextModal";
import { NetworkEntityModal } from "./NetworkEntityModal";
import type { NetworkEntity } from "./NetworkEntityModal";
import { InventoryFilterSelect } from "./InventoryFilterSelect";
import { providerGlossary, TechnicalText } from "./ProviderGlossary";
import type {
  EquipmentPath,
  InventoryFilter,
  InventoryPage,
  InventoryRecord,
  InventorySort,
  TopologySnapshot,
} from "./types";

const number = new Intl.NumberFormat("pt-BR");

type InventoryStatus = "active" | "removed" | "all";

const statusLabel = {
  active: "Ativo",
  removed: "Removido",
} as const;

const inventorySortOptions: Array<{ value: InventorySort; label: string }> = [
  { value: "customer_id_asc", label: "Cliente (A–Z)" },
  { value: "customer_id_desc", label: "Cliente (Z–A)" },
  { value: "serial_asc", label: "Serial (A–Z)" },
  { value: "serial_desc", label: "Serial (Z–A)" },
  { value: "equipment_asc", label: "Equipamento (A–Z)" },
  { value: "equipment_desc", label: "Equipamento (Z–A)" },
  { value: "firmware_plan_asc", label: "Firmware / plano (A–Z)" },
  { value: "firmware_plan_desc", label: "Firmware / plano (Z–A)" },
  { value: "topology_asc", label: "Topologia (A–Z)" },
  { value: "topology_desc", label: "Topologia (Z–A)" },
  { value: "status_asc", label: "Situação (A–Z)" },
  { value: "status_desc", label: "Situação (Z–A)" },
];

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
  const [sort, setSort] = useState<InventorySort>("customer_id_asc");
  const [data, setData] = useState<InventoryPage | null>(null);
  const [topology, setTopology] = useState<TopologySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [topologyError, setTopologyError] = useState("");
  const [filters, setFilters] = useState<InventoryFilter[]>([]);
  const [contextModal, setContextModal] = useState<InventoryContext | null>(
    null,
  );
  const [networkModal, setNetworkModal] = useState<NetworkEntity | null>(null);

  useEffect(() => {
    void load();
  }, [submittedQuery, page, status, filters, sort]);

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
      setData(await api.inventory(submittedQuery, page, status, filters, sort));
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
                  <strong>
                    <TechnicalText text={olt.olt} />
                  </strong>
                  <small>{olt.cities.join(" · ")}</small>
                </div>
              </header>
              <dl>
                <div>
                  <dt>
                    <TechnicalText text="Portas PON" />
                  </dt>
                  <dd>{number.format(olt.pons)}</dd>
                </div>
                <div>
                  <dt>
                    <TechnicalText text="CTOs" />
                  </dt>
                  <dd>{number.format(olt.ctos)}</dd>
                </div>
                <div>
                  <dt>
                    <TechnicalText text="CPEs ativas" />
                  </dt>
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
          >
            <InventoryFilterSelect
              filters={filters}
              onChange={(nextFilters) => {
                setFilters(nextFilters);
                setSubmittedQuery("");
                setPage(1);
              }}
              query={query}
              onQueryChange={setQuery}
              status={status}
              placeholder="Cliente, serial, modelo, firmware, plano, OLT, CTO ou localidade"
              ariaLabel="Adicionar filtros ao inventário"
              optionsId="inventory-filter-options"
              showFreeSearch
              showClear={filters.length > 0 || Boolean(submittedQuery)}
              onFreeSearch={(nextQuery) => {
                setSubmittedQuery(nextQuery);
                setPage(1);
              }}
            />
          </form>
          <div className="inventory-toolbar-actions">
            <label className="inventory-sort-control">
              <span>Ordenar por</span>
              <select
                aria-label="Ordenar equipamentos"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as InventorySort);
                  setPage(1);
                }}
              >
                {inventorySortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
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
        </div>

        {error && <p className="inventory-error">{error}</p>}
        <div className="inventory-equipment-cards" aria-label="Equipamentos do inventário">
          {data?.data.map((item) => (
            <article className="inventory-equipment-card" key={item.serial}>
              <header className="inventory-equipment-card-header">
                <button
                  className="inventory-card-link inventory-customer-card-link"
                  type="button"
                  onClick={() => setContextModal({ kind: "customer", item })}
                  title="Ver informações gerais do cliente"
                >
                  <span className="inventory-card-eyebrow">Cliente</span>
                  <strong className="inventory-code">{item.customer_id}</strong>
                  <small>
                    <MapPin size={13} /> {item.neighborhood} · {item.city}
                  </small>
                </button>
                <span className={`inventory-badge ${item.status}`}>
                  {statusLabel[item.status]}
                </span>
              </header>

              <div className="inventory-equipment-card-grid">
                <div className="inventory-equipment-card-field">
                  <span className="inventory-card-eyebrow">
                    Serial da CPE
                    <HelpTooltip
                      term="CPE e serial"
                      description={`${providerGlossary.cpe.description} ${providerGlossary.serial.description}`}
                    />
                  </span>
                  <button
                    className="inventory-card-link inventory-card-serial"
                    type="button"
                    onClick={() => openEquipment(item)}
                    title="Ver detalhes desta CPE"
                  >
                    <code>{item.serial}</code>
                  </button>
                </div>

                <div className="inventory-equipment-card-field">
                  <span className="inventory-card-eyebrow">
                    Equipamento
                    <HelpTooltip
                      term="Revisão de hardware"
                      description={providerGlossary.hardware.description}
                    />
                  </span>
                  <button
                    className="inventory-card-link"
                    type="button"
                    onClick={() => openEquipment(item)}
                    title="Ver detalhes deste equipamento"
                  >
                    <strong>
                      {item.vendor} {item.model}
                    </strong>
                    <small>rev. {item.hw_revision}</small>
                  </button>
                </div>

                <div className="inventory-equipment-card-field">
                  <span className="inventory-card-eyebrow">
                    Firmware
                    <HelpTooltip
                      term="Firmware"
                      description={providerGlossary.firmware.description}
                    />
                  </span>
                  <button
                    className="inventory-card-link"
                    type="button"
                    title={providerGlossary.firmware.description}
                    onClick={() => setContextModal({ kind: "firmware", item })}
                  >
                    <strong>fw {item.software_version}</strong>
                  </button>
                </div>

                <div className="inventory-equipment-card-field">
                  <span className="inventory-card-eyebrow">
                    Plano contratado
                    <HelpTooltip
                      term="Plano"
                      description={`Velocidade contratada pelo cliente. ${providerGlossary.mbps.description}`}
                    />
                  </span>
                  <button
                    className="inventory-card-link"
                    type="button"
                    title={providerGlossary.mbps.description}
                    onClick={() => setContextModal({ kind: "plan", item })}
                  >
                    <strong>{item.plan_mbps} Mbps</strong>
                  </button>
                </div>
              </div>

              <footer className="inventory-equipment-card-footer">
                <div className="inventory-equipment-topology">
                  <span className="inventory-card-eyebrow">
                    Topologia
                    <HelpTooltip
                      term="OLT, PON e CTO"
                      description={`${providerGlossary.olt.description} ${providerGlossary.pon.description} ${providerGlossary.cto.description}`}
                    />
                  </span>
                  <div className="inventory-topology-actions">
                    <Server size={14} />
                    <button
                      type="button"
                      title={providerGlossary.olt.description}
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
                    <button
                      type="button"
                      title={providerGlossary.pon.description}
                      onClick={() => void openPon(item)}
                    >
                      PON {item.pon_port}
                    </button>
                    <button
                      className="inventory-cto-action"
                      type="button"
                      title={providerGlossary.cto.description}
                      onClick={() => void openCto(item)}
                    >
                      {item.cto}
                    </button>
                  </div>
                </div>
                <span className="inventory-card-hint">Abrir detalhes</span>
              </footer>
            </article>
          ))}
          {!loading && data?.data.length === 0 && (
            <div className="inventory-empty-card">
              Nenhum cadastro encontrado. Tente outro código, serial ou filtro.
            </div>
          )}
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
