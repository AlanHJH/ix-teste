import { FormEvent, useEffect, useState } from "react";
import { Boxes, Cable, MapPin, Search, Server, Waypoints } from "lucide-react";
import { api } from "./api";
import { HelpTooltip } from "./HelpTooltip";
import { NetworkEntityModal } from "./NetworkEntityModal";
import type { NetworkEntity } from "./NetworkEntityModal";
import { NetworkExplorerGraph } from "./NetworkExplorerGraph";
import { providerGlossary, TechnicalText } from "./ProviderGlossary";
import type { EquipmentPath, TopologySnapshot } from "./types";

const number = new Intl.NumberFormat("pt-BR");

export function PhysicalTopology() {
  const [topology, setTopology] = useState<TopologySnapshot | null>(null);
  const [ponsByOlt, setPonsByOlt] = useState<
    Record<string, TopologySnapshot["pons"]>
  >({});
  const [selectedOlt, setSelectedOlt] = useState("");
  const [selectedPon, setSelectedPon] = useState("");
  const [selectedCto, setSelectedCto] = useState("");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<EquipmentPath[]>([]);
  const [selectedPath, setSelectedPath] = useState<EquipmentPath | null>(null);
  const [devices, setDevices] = useState<EquipmentPath[]>([]);
  const [modalEntity, setModalEntity] = useState<NetworkEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadInitialTopology();
  }, []);

  useEffect(() => {
    if (!selectedOlt || !selectedPon || !selectedCto) {
      setDevices([]);
      return;
    }
    let canceled = false;
    api
      .topologyDevices(selectedOlt, selectedPon, selectedCto)
      .then((result) => {
        if (!canceled) setDevices(result);
      })
      .catch((reason) => {
        if (!canceled) {
          setDevices([]);
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível carregar as CPEs da CTO",
          );
        }
      });
    return () => {
      canceled = true;
    };
  }, [selectedOlt, selectedPon, selectedCto]);

  async function loadInitialTopology() {
    setLoading(true);
    setError("");
    try {
      const root = await api.topology();
      setTopology(root);
      const branches = await Promise.all(
        root.olts.map(async (item) => {
          const branch = await api.topology(item.olt);
          return [item.olt, branch.pons] as const;
        }),
      );
      setPonsByOlt(Object.fromEntries(branches));
      const initialOlt =
        root.olts.find((item) => item.olt === "OLT-2") ?? root.olts[0];
      if (initialOlt) await chooseOlt(initialOlt.olt, true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar a topologia",
      );
    } finally {
      setLoading(false);
    }
  }

  async function chooseOlt(olt: string, expandPreferredPon = false) {
    setLoading(true);
    setError("");
    setSelectedOlt(olt);
    setSelectedPon("");
    setSelectedCto("");
    setSelectedPath(null);
    setDevices([]);
    try {
      const branch = await api.topology(olt);
      setTopology(branch);
      if (expandPreferredPon) {
        const preferred =
          branch.pons.find((item) => item.pon === "1/7") ?? branch.pons[0];
        if (preferred) await choosePon(olt, preferred.pon);
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar as portas PON",
      );
    } finally {
      setLoading(false);
    }
  }

  async function choosePon(olt: string, pon: string) {
    setLoading(true);
    setError("");
    setSelectedOlt(olt);
    setSelectedPon(pon);
    setSelectedCto("");
    setSelectedPath(null);
    setDevices([]);
    try {
      const branch = await api.topology(olt, pon);
      setTopology(branch);
      setSelectedCto("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar as CTOs",
      );
    } finally {
      setLoading(false);
    }
  }

  async function searchPath(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.topologyPath(query);
      setMatches(result);
      if (result.length === 1) await selectPath(result[0]);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível localizar o equipamento",
      );
    } finally {
      setLoading(false);
    }
  }

  async function selectPath(path: EquipmentPath) {
    setSelectedCto(path.cto);
    setMatches([]);
    await choosePon(path.olt, path.pon);
    setSelectedCto(path.cto);
    setSelectedPath(path);
  }

  const selectedCtoDetails = topology?.ctos.find(
    (item) => item.cto === selectedCto,
  );
  const directChildren = modalEntity
    ? modalEntity.kind === "olt"
      ? {
          count: modalEntity.data.pons,
          label: "PONs",
          expanded: selectedOlt === modalEntity.data.olt,
          onExpand: () => void chooseOlt(modalEntity.data.olt),
        }
      : modalEntity.kind === "pon"
        ? {
            count: modalEntity.data.ctos,
            label: "CTOs",
            expanded:
              selectedOlt === modalEntity.olt &&
              selectedPon === modalEntity.data.pon,
            onExpand: () =>
              void choosePon(modalEntity.olt, modalEntity.data.pon),
          }
        : modalEntity.kind === "cto"
          ? {
              count: modalEntity.data.cpes,
              label: "CPEs",
              expanded:
                selectedOlt === modalEntity.olt &&
                selectedPon === modalEntity.pon &&
                selectedCto === modalEntity.data.cto,
              onExpand: () => {
                setSelectedOlt(modalEntity.olt);
                setSelectedPon(modalEntity.pon);
                setSelectedCto(modalEntity.data.cto);
                setSelectedPath(null);
              },
            }
          : undefined
    : undefined;
  const route = selectedPath
    ? {
        olt: selectedPath.olt,
        pon: selectedPath.pon,
        cto: selectedPath.cto,
        drop: selectedPath.logical_drop_id ?? "Drop lógico pendente",
        cpe: selectedPath.serial,
      }
    : {
        olt: selectedOlt || "—",
        pon: selectedPon || "—",
        cto: selectedCto || "—",
        drop: "Selecione uma CPE",
        cpe: selectedCtoDetails
          ? `${number.format(selectedCtoDetails.cpes)} CPEs`
          : "—",
      };

  return (
    <section className="physical-topology">
      <section className="physical-heading">
        <div>
          <span className="section-label">Infraestrutura física</span>
          <h2>
            Do equipamento de acesso até a <TechnicalText text="CPE" /> do
            cliente.
          </h2>
          <p>
            Navegue pela hierarquia real do inventário ou pesquise um cliente ou
            serial para destacar seu caminho de conexão.
          </p>
        </div>
        {topology && (
          <div className="physical-totals" aria-label="Totais da topologia">
            <span>
              <strong>{number.format(topology.totals.olts)}</strong>{" "}
              <TechnicalText text="OLTs" />
            </span>
            <span>
              <strong>{number.format(topology.totals.pons)}</strong>{" "}
              <TechnicalText text="PONs" />
            </span>
            <span>
              <strong>{number.format(topology.totals.ctos)}</strong>{" "}
              <TechnicalText text="CTOs" />
            </span>
            <span>
              <strong>{number.format(topology.totals.cpes)}</strong>{" "}
              <TechnicalText text="CPEs" /> ativas
            </span>
          </div>
        )}
      </section>

      <form className="physical-search" onSubmit={searchPath}>
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Localize por código do cliente ou serial da CPE"
          aria-label="Código do cliente ou serial da CPE"
        />
        <button disabled={loading}>Localizar caminho</button>
      </form>
      {matches.length > 1 && (
        <div className="physical-matches" aria-label="Equipamentos encontrados">
          {matches.map((path) => (
            <button
              key={path.serial}
              type="button"
              onClick={() => void selectPath(path)}
            >
              <strong>{path.customer_id}</strong>
              <span>
                {path.serial} · {path.vendor} {path.model}
              </span>
            </button>
          ))}
        </div>
      )}

      {topology?.limitations && (
        <div className="topology-limit" role="note">
          <Cable size={18} />
          <p>
            <strong>Limite dos dados atuais:</strong>{" "}
            <TechnicalText text={topology.limitations.message} />
          </p>
        </div>
      )}

      {error && <p className="physical-error">{error}</p>}

      {topology && (
        <NetworkExplorerGraph
          topology={topology}
          devices={devices}
          ponsByOlt={ponsByOlt}
          selectedOlt={selectedOlt}
          selectedPon={selectedPon}
          selectedCto={selectedCto}
          selectedPath={selectedPath}
          highlightedEntity={modalEntity}
          onSelectOlt={(entity) => {
            setModalEntity(entity);
          }}
          onSelectPon={(entity) => {
            setModalEntity(entity);
          }}
          onSelectCto={(entity) => {
            setModalEntity(entity);
          }}
          onSelectDevice={(entity) => {
            setModalEntity(entity);
            setSelectedPath(entity.data);
          }}
        />
      )}

      <section
        className="physical-route"
        aria-label="Caminho físico selecionado"
      >
        <div className="physical-route-node olt">
          <Server size={19} />
          <span>
            OLT
            <HelpTooltip
              term="OLT"
              description={providerGlossary.olt.description}
            />
          </span>
          <strong>{route.olt}</strong>
        </div>
        <Waypoints className="physical-route-arrow" aria-hidden="true" />
        <div className="physical-route-node pon">
          <Cable size={19} />
          <span>
            Porta PON
            <HelpTooltip
              term="PON"
              description={providerGlossary.pon.description}
            />
          </span>
          <strong>{route.pon}</strong>
        </div>
        <Waypoints className="physical-route-arrow" aria-hidden="true" />
        <div className="physical-route-node cto">
          <MapPin size={19} />
          <span>
            CTO
            <HelpTooltip
              term="CTO"
              description={providerGlossary.cto.description}
            />
          </span>
          <strong>{route.cto}</strong>
        </div>
        <Waypoints className="physical-route-arrow" aria-hidden="true" />
        <div className="physical-route-node drop">
          <Cable size={19} />
          <span>
            Drop lógico
            <HelpTooltip
              term="Drop"
              description={providerGlossary.drop.description}
            />
          </span>
          <strong>{route.drop}</strong>
        </div>
        <Waypoints className="physical-route-arrow" aria-hidden="true" />
        <div className="physical-route-node cpe">
          <Boxes size={19} />
          <span>
            CPE / equipamento
            <HelpTooltip
              term="CPE"
              description={providerGlossary.cpe.description}
            />
          </span>
          <strong>{route.cpe}</strong>
        </div>
      </section>

      <section className="physical-browser">
        <div className="physical-column">
          <header>
            <span>01</span>
            <div>
              <strong>OLTs</strong>
              <small>pontos de acesso</small>
            </div>
          </header>
          <div className="physical-list olt-list">
            {topology?.olts.map((item) => (
              <button
                key={item.olt}
                type="button"
                title="Seleciona a OLT e carrega suas portas PON."
                className={item.olt === selectedOlt ? "selected" : ""}
                onClick={() => {
                  setModalEntity({ kind: "olt", data: item });
                  void chooseOlt(item.olt);
                }}
              >
                <strong>{item.olt}</strong>
                <span>
                  {number.format(item.pons)} PONs · {number.format(item.ctos)}{" "}
                  CTOs
                </span>
                <small>{item.cities.join(", ")}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="physical-column">
          <header>
            <span>02</span>
            <div>
              <strong>Portas PON</strong>
              <small>{selectedOlt || "Selecione uma OLT"}</small>
            </div>
          </header>
          <div className="physical-list pon-list">
            {topology?.pons.map((item) => (
              <button
                key={item.pon}
                type="button"
                title="Seleciona esta porta PON e mostra as CTOs conectadas."
                className={item.pon === selectedPon ? "selected" : ""}
                onClick={() => {
                  setModalEntity({ kind: "pon", olt: selectedOlt, data: item });
                  void choosePon(selectedOlt, item.pon);
                }}
              >
                <strong>{item.pon}</strong>
                <span>{number.format(item.ctos)} CTOs</span>
                <small>{number.format(item.cpes)} CPEs ativas</small>
              </button>
            ))}
          </div>
        </div>

        <div className="physical-column">
          <header>
            <span>03</span>
            <div>
              <strong>CTOs</strong>
              <small>
                {selectedPon
                  ? `${selectedOlt} · PON ${selectedPon}`
                  : "Selecione uma porta"}
              </small>
            </div>
          </header>
          <div className="physical-list cto-list">
            {topology?.ctos.map((item) => (
              <button
                key={item.cto}
                type="button"
                title="Seleciona esta CTO e mostra as CPEs atendidas."
                className={item.cto === selectedCto ? "selected" : ""}
                onClick={() => {
                  setModalEntity({
                    kind: "cto",
                    olt: selectedOlt,
                    pon: selectedPon,
                    data: item,
                  });
                  setSelectedCto(item.cto);
                  setSelectedPath(null);
                }}
              >
                <strong>{item.cto}</strong>
                <span>
                  {item.neighborhood} · {item.city}
                </span>
                <small>
                  {number.format(item.cpes)} relações de drop lógico estimadas
                </small>
              </button>
            ))}
          </div>
        </div>

        <aside className="physical-equipment">
          <header>
            <span>04</span>
            <div>
              <strong>Equipamento</strong>
              <small>endpoint pesquisado</small>
            </div>
          </header>
          {selectedPath ? (
            <div className="equipment-card">
              <strong>{selectedPath.serial}</strong>
              <span>Cliente {selectedPath.customer_id}</span>
              <dl>
                <div>
                  <dt>
                    Hardware
                    <HelpTooltip
                      term="Hardware"
                      description={providerGlossary.hardware.description}
                    />
                  </dt>
                  <dd>
                    {selectedPath.vendor} {selectedPath.model} · rev.{" "}
                    {selectedPath.hw_revision}
                  </dd>
                </div>
                <div>
                  <dt>
                    Firmware
                    <HelpTooltip
                      term="Firmware"
                      description={providerGlossary.firmware.description}
                    />
                  </dt>
                  <dd>{selectedPath.software_version}</dd>
                </div>
                <div>
                  <dt>Plano</dt>
                  <dd>
                    <TechnicalText text={`${selectedPath.plan_mbps} Mbps`} />
                  </dd>
                </div>
                <div>
                  <dt>
                    Drop lógico
                    <HelpTooltip
                      term="Drop"
                      description={providerGlossary.drop.description}
                    />
                  </dt>
                  <dd>{selectedPath.logical_drop_id ?? "Indisponível"}</dd>
                </div>
                <div>
                  <dt>Local</dt>
                  <dd>
                    {selectedPath.neighborhood} · {selectedPath.city}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="equipment-empty">
              <Boxes size={30} />
              <p>
                Pesquise um cliente ou serial para revelar uma CPE específica e
                seu caminho até a OLT.
              </p>
            </div>
          )}
        </aside>
      </section>
      {modalEntity && (
        <NetworkEntityModal
          entity={modalEntity}
          directChildren={directChildren}
          onClose={() => setModalEntity(null)}
        />
      )}
    </section>
  );
}
