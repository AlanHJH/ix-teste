import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { NetworkEntityModal } from "./NetworkEntityModal";
import type { NetworkEntity } from "./NetworkEntityModal";
import { NetworkExplorerGraph } from "./NetworkExplorerGraph";
import type { EquipmentPath, TopologySnapshot } from "./types";

export function PhysicalTopology() {
  const [topology, setTopology] = useState<TopologySnapshot | null>(null);
  const [selectedOlt, setSelectedOlt] = useState("");
  const [selectedPon, setSelectedPon] = useState("");
  const [selectedCto, setSelectedCto] = useState("");
  const [selectedPath, setSelectedPath] = useState<EquipmentPath | null>(null);
  const [devicesByCto, setDevicesByCto] = useState<
    Record<string, EquipmentPath[]>
  >({});
  const [modalEntity, setModalEntity] = useState<NetworkEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const activeBranch = useRef("");

  useEffect(() => {
    void loadInitialTopology();
  }, []);

  async function loadInitialTopology() {
    setLoading(true);
    setError("");
    try {
      const root = await api.topology();
      const initialOlt =
        root.olts.find((item) => item.olt === "OLT-2") ?? root.olts[0];

      if (!initialOlt) {
        setTopology(root);
        return;
      }

      await chooseOlt(initialOlt.olt);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar a infraestrutura de rede",
      );
    } finally {
      setLoading(false);
    }
  }

  async function chooseOlt(olt: string) {
    activeBranch.current = `${olt}:`;
    setLoading(true);
    setError("");
    setSelectedOlt(olt);
    setSelectedPon("");
    setSelectedCto("");
    setSelectedPath(null);
    setDevicesByCto({});
    setModalEntity(null);

    try {
      setTopology(await api.topology(olt));
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
    activeBranch.current = `${olt}:${pon}`;
    setLoading(true);
    setError("");
    setSelectedOlt(olt);
    setSelectedPon(pon);
    setSelectedCto("");
    setSelectedPath(null);
    setDevicesByCto({});

    try {
      setTopology(await api.topology(olt, pon));
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

  async function expandCto(olt: string, pon: string, cto: string) {
    const branch = `${olt}:${pon}`;
    activeBranch.current = branch;
    setError("");
    setSelectedOlt(olt);
    setSelectedPon(pon);
    setSelectedCto(cto);
    setSelectedPath(null);

    if (Object.prototype.hasOwnProperty.call(devicesByCto, cto)) return;

    setDevicesByCto((current) => ({ ...current, [cto]: [] }));
    try {
      const devices = await api.topologyDevices(olt, pon, cto);
      if (activeBranch.current !== branch) return;
      setDevicesByCto((current) => ({ ...current, [cto]: devices }));
    } catch (reason) {
      if (activeBranch.current !== branch) return;
      setDevicesByCto((current) => {
        const next = { ...current };
        delete next[cto];
        return next;
      });
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar as CPEs da CTO",
      );
    }
  }

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
                Object.prototype.hasOwnProperty.call(
                  devicesByCto,
                  modalEntity.data.cto,
                ),
              onExpand: () =>
                void expandCto(
                  modalEntity.olt,
                  modalEntity.pon,
                  modalEntity.data.cto,
                ),
            }
          : undefined
    : undefined;

  return (
    <section className="physical-topology">
      {error && <p className="physical-error">{error}</p>}

      {topology ? (
        <NetworkExplorerGraph
          topology={topology}
          devicesByCto={devicesByCto}
          selectedOlt={selectedOlt}
          selectedPon={selectedPon}
          selectedCto={selectedCto}
          selectedPath={selectedPath}
          highlightedEntity={modalEntity}
          loading={loading}
          onChangeOlt={(olt) => void chooseOlt(olt)}
          onSelectOlt={setModalEntity}
          onSelectPon={setModalEntity}
          onSelectCto={setModalEntity}
          onSelectDevice={(entity) => {
            setModalEntity(entity);
            setSelectedCto(entity.data.cto);
            setSelectedPath(entity.data);
          }}
        />
      ) : (
        <div className="network-map-loading" role="status">
          <span />
          <p>Carregando infraestrutura de rede…</p>
        </div>
      )}

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
