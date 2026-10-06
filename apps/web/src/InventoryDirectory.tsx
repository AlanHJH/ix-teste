import { FormEvent, useEffect, useState } from "react";
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  MapPin,
  Search,
  Server,
  Users,
} from "lucide-react";
import { api } from "./api";
import { HelpTooltip } from "./HelpTooltip";
import { providerGlossary, TechnicalText } from "./ProviderGlossary";
import type { InventoryPage, TopologySnapshot } from "./types";

const number = new Intl.NumberFormat("pt-BR");

type InventoryStatus = "active" | "removed" | "all";

const statusLabel = {
  active: "Ativo",
  removed: "Removido",
} as const;

export function InventoryDirectory({
  onOpenSupport,
}: {
  onOpenSupport: (customerId: string) => void;
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

  useEffect(() => {
    void load();
  }, [submittedQuery, page, status]);

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
      setData(await api.inventory(submittedQuery, page, status));
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
    setQuery(olt);
    setSubmittedQuery(olt);
    setStatus("active");
    setPage(1);
  }

  const firstItem = data
    ? data.total === 0
      ? 0
      : (data.page - 1) * data.limit + 1
    : 0;
  const lastItem = data ? Math.min(data.page * data.limit, data.total) : 0;
  const hasNextPage = data ? data.page * data.limit < data.total : false;

  return (
    <section className="inventory-page">
      <section className="inventory-hero">
        <div>
          <span className="section-label">Cadastros operacionais</span>
          <h1>Clientes e equipamentos</h1>
          <p>
            Consulte o inventário para localizar códigos de cliente, serial de
            <TechnicalText text="CPE" />, modelo, <TechnicalText text="CTO" /> e
            conexão de rede antes de testar um caso no{" "}
            <TechnicalText text="N1" />.
          </p>
          <span className="inventory-help-note">
            <CircleHelp size={15} /> Passe sobre ou navegue até a ajuda para ver
            a explicação dos termos técnicos.
          </span>
        </div>
        <div className="inventory-metrics" aria-label="Resumo do cadastro">
          <span>
            <Users size={17} />
            <strong>{data ? number.format(data.total) : "—"}</strong>
            resultados
          </span>
          <span>
            <Boxes size={17} />
            inventário navegável
          </span>
        </div>
      </section>

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
          <form className="inventory-search" onSubmit={submit}>
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Código, serial, fabricante, modelo, OLT, CTO ou localidade"
              aria-label="Pesquisar no cadastro"
            />
            <button disabled={loading}>
              {loading ? "Buscando…" : "Pesquisar"}
            </button>
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
              {data?.items.map((item) => (
                <tr key={item.serial}>
                  <td>
                    <strong className="inventory-code">
                      {item.customer_id}
                    </strong>
                    <small>
                      <MapPin size={13} /> {item.neighborhood} · {item.city}
                    </small>
                  </td>
                  <td>
                    <code>{item.serial}</code>
                  </td>
                  <td>
                    <strong>
                      {item.vendor} {item.model}
                    </strong>
                    <small>rev. {item.hw_revision}</small>
                  </td>
                  <td>
                    <strong>fw {item.software_version}</strong>
                    <small>{item.plan_mbps} Mbps</small>
                  </td>
                  <td>
                    <strong>
                      <Server size={14} /> {item.olt} · PON {item.pon_port}
                    </strong>
                    <small>{item.cto}</small>
                  </td>
                  <td>
                    <span className={`inventory-badge ${item.status}`}>
                      {statusLabel[item.status]}
                    </span>
                    {item.status === "active" && (
                      <button
                        className="inventory-action"
                        type="button"
                        title="Abre o atendimento N1 para investigar este cliente com os dados do inventário."
                        onClick={() => onOpenSupport(item.customer_id)}
                      >
                        Usar no N1
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && data?.items.length === 0 && (
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
              ? `Exibindo ${number.format(firstItem)}–${number.format(lastItem)} de ${number.format(data.total)} registros`
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
    </section>
  );
}
