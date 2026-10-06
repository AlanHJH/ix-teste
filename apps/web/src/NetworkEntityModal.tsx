import { useEffect } from "react";
import { Boxes, Cable, GitBranch, MapPin, Server, X } from "lucide-react";
import { HelpTooltip } from "./HelpTooltip";
import { providerGlossary } from "./ProviderGlossary";
import type { EquipmentPath, TopologySnapshot } from "./types";

type Olt = TopologySnapshot["olts"][number];
type Pon = TopologySnapshot["pons"][number];
type Cto = TopologySnapshot["ctos"][number];

export type NetworkEntity =
  | { kind: "olt"; data: Olt }
  | { kind: "pon"; olt: string; data: Pon }
  | { kind: "cto"; olt: string; pon: string; data: Cto }
  | { kind: "cpe"; data: EquipmentPath };

export type DirectChildrenAction = {
  count: number;
  label: string;
  expanded: boolean;
  onExpand: () => void;
};

const number = new Intl.NumberFormat("pt-BR");

const detailHints: Record<string, string> = {
  "Portas PON ativas": providerGlossary.pon.description,
  "CTOs atendidas": providerGlossary.cto.description,
  "CTOs conectadas": providerGlossary.cto.description,
  "CPEs ativas": providerGlossary.cpe.description,
  "OLT de origem": providerGlossary.olt.description,
  "Porta PON": providerGlossary.pon.description,
  "Drop lógico": providerGlossary.drop.description,
  "Relações de drop": providerGlossary.drop.description,
  Firmware: providerGlossary.firmware.description,
  Equipamento: providerGlossary.hardware.description,
  "Plano contratado": providerGlossary.mbps.description,
  Caminho: providerGlossary.logicalTopology.description,
};

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>
        {label}
        {detailHints[label] && (
          <HelpTooltip term={label} description={detailHints[label]} />
        )}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

export function NetworkEntityModal({
  entity,
  onClose,
  directChildren,
}: {
  entity: NetworkEntity;
  onClose: () => void;
  directChildren?: DirectChildrenAction;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const details =
    entity.kind === "olt" ? (
      <>
        <header>
          <span className="entity-modal-icon olt">
            <Server size={22} />
          </span>
          <div>
            <span className="section-label">Equipamento de acesso</span>
            <h3>{entity.data.olt}</h3>
            <p>{entity.data.cities.join(" · ")}</p>
          </div>
        </header>
        <dl>
          <Detail
            label="Portas PON ativas"
            value={number.format(entity.data.pons)}
          />
          <Detail
            label="CTOs atendidas"
            value={number.format(entity.data.ctos)}
          />
          <Detail label="CPEs ativas" value={number.format(entity.data.cpes)} />
          <Detail
            label="Bairros cobertos"
            value={entity.data.neighborhoods.join(" · ")}
          />
        </dl>
      </>
    ) : entity.kind === "pon" ? (
      <>
        <header>
          <span className="entity-modal-icon pon">
            <Cable size={22} />
          </span>
          <div>
            <span className="section-label">Porta de acesso óptico</span>
            <h3>PON {entity.data.pon}</h3>
            <p>{entity.olt}</p>
          </div>
        </header>
        <dl>
          <Detail label="OLT de origem" value={entity.olt} />
          <Detail
            label="CTOs conectadas"
            value={number.format(entity.data.ctos)}
          />
          <Detail label="CPEs ativas" value={number.format(entity.data.cpes)} />
          <Detail label="Tipo de vínculo" value="Porta PON compartilhada" />
        </dl>
      </>
    ) : entity.kind === "cto" ? (
      <>
        <header>
          <span className="entity-modal-icon cto">
            <MapPin size={22} />
          </span>
          <div>
            <span className="section-label">Caixa de distribuição óptica</span>
            <h3>{entity.data.cto}</h3>
            <p>
              {entity.data.neighborhood} · {entity.data.city}
            </p>
          </div>
        </header>
        <dl>
          <Detail label="OLT de origem" value={entity.olt} />
          <Detail label="Porta PON" value={entity.pon} />
          <Detail label="CPEs ativas" value={number.format(entity.data.cpes)} />
          <Detail
            label="Relações de drop"
            value="Estimadas por CPE; sem ID físico de campo"
          />
        </dl>
      </>
    ) : (
      <>
        <header>
          <span className="entity-modal-icon cpe">
            <Boxes size={22} />
          </span>
          <div>
            <span className="section-label">CPE / equipamento do cliente</span>
            <h3>{entity.data.serial}</h3>
            <p>Cliente {entity.data.customer_id}</p>
          </div>
        </header>
        <dl>
          <Detail
            label="Equipamento"
            value={`${entity.data.vendor} ${entity.data.model} · rev. ${entity.data.hw_revision}`}
          />
          <Detail label="Firmware" value={entity.data.software_version} />
          <Detail
            label="Plano contratado"
            value={`${entity.data.plan_mbps} Mbps`}
          />
          <Detail
            label="Caminho"
            value={`${entity.data.olt} · PON ${entity.data.pon} · ${entity.data.cto}`}
          />
          <Detail
            label="Drop lógico"
            value={entity.data.logical_drop_id ?? "Indisponível"}
          />
          <Detail
            label="Localidade"
            value={`${entity.data.neighborhood} · ${entity.data.city}`}
          />
        </dl>
      </>
    );

  return (
    <div
      className="entity-modal-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className={`entity-modal ${entity.kind}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entity-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="entity-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Fechar detalhes"
          title="Fecha esta janela de detalhes."
          autoFocus
        >
          <X size={19} />
        </button>
        <div id="entity-modal-title">{details}</div>
        {directChildren && (
          <div className="entity-modal-children">
            <div>
              <span>Próxima camada</span>
              <p>
                {directChildren.count} {directChildren.label}. A expansão mostra
                apenas os filhos diretos, sem abrir os níveis seguintes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                directChildren.onExpand();
                onClose();
              }}
              disabled={directChildren.expanded}
              title="Exibe somente os filhos diretos deste nó no grafo."
            >
              <GitBranch size={16} aria-hidden="true" />
              {directChildren.expanded
                ? "Filhos diretos exibidos"
                : `Exibir ${directChildren.count} ${directChildren.label}`}
            </button>
          </div>
        )}
        {entity.kind === "cto" && (
          <p className="entity-modal-note">
            Cada CPE ativa recebe um identificador lógico estimado. O
            identificador físico de campo de cada drop não foi fornecido pela
            fonte.
          </p>
        )}
      </section>
    </div>
  );
}
