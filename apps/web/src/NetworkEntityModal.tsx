import { Boxes, Cable, GitBranch, MapPin, Server } from "lucide-react";
import { EntityDetailModal } from "./EntityDetailModal";
import type { EntityDetailItem } from "./EntityDetailModal";
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

export function NetworkEntityModal({
  entity,
  onClose,
  directChildren,
}: {
  entity: NetworkEntity;
  onClose: () => void;
  directChildren?: DirectChildrenAction;
}) {
  let icon = <Boxes size={22} />;
  let eyebrow = "CPE / equipamento do cliente";
  let title = entity.kind === "cpe" ? entity.data.serial : "";
  let subtitle =
    entity.kind === "cpe" ? `Cliente ${entity.data.customer_id}` : "";
  let details: EntityDetailItem[] = [];

  if (entity.kind === "olt") {
    icon = <Server size={22} />;
    eyebrow = "Equipamento de acesso";
    title = entity.data.olt;
    subtitle = entity.data.cities.join(" · ");
    details = [
      { label: "Portas PON ativas", value: number.format(entity.data.pons) },
      { label: "CTOs atendidas", value: number.format(entity.data.ctos) },
      { label: "CPEs ativas", value: number.format(entity.data.cpes) },
      {
        label: "Bairros cobertos",
        value: entity.data.neighborhoods.join(" · "),
      },
    ];
  } else if (entity.kind === "pon") {
    icon = <Cable size={22} />;
    eyebrow = "Porta de acesso óptico";
    title = `PON ${entity.data.pon}`;
    subtitle = entity.olt;
    details = [
      { label: "OLT de origem", value: entity.olt },
      { label: "CTOs conectadas", value: number.format(entity.data.ctos) },
      { label: "CPEs ativas", value: number.format(entity.data.cpes) },
      { label: "Tipo de vínculo", value: "Porta PON compartilhada" },
    ];
  } else if (entity.kind === "cto") {
    icon = <MapPin size={22} />;
    eyebrow = "Caixa de distribuição óptica";
    title = entity.data.cto;
    subtitle = `${entity.data.neighborhood} · ${entity.data.city}`;
    details = [
      { label: "OLT de origem", value: entity.olt },
      { label: "Porta PON", value: entity.pon },
      { label: "CPEs ativas", value: number.format(entity.data.cpes) },
      {
        label: "Relações de drop",
        value: "Estimadas por CPE; sem ID físico de campo",
      },
    ];
  } else {
    details = [
      {
        label: "Equipamento",
        value: `${entity.data.vendor} ${entity.data.model} · rev. ${entity.data.hw_revision}`,
      },
      { label: "Firmware", value: entity.data.software_version },
      {
        label: "Plano contratado",
        value: `${entity.data.plan_mbps} Mbps`,
      },
      {
        label: "Caminho",
        value: `${entity.data.olt} · PON ${entity.data.pon} · ${entity.data.cto}`,
      },
      {
        label: "Drop lógico",
        value: entity.data.logical_drop_id ?? "Indisponível",
      },
      {
        label: "Localidade",
        value: `${entity.data.neighborhood} · ${entity.data.city}`,
      },
    ];
  }

  details = details.map((detail) => ({
    ...detail,
    hint: detailHints[detail.label],
  }));

  return (
    <EntityDetailModal
      variant={entity.kind}
      icon={icon}
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      details={details}
      note={
        entity.kind === "cto"
          ? "Cada CPE ativa recebe um identificador lógico estimado. O identificador físico de campo de cada drop não foi fornecido pela fonte."
          : entity.kind === "cpe" && !entity.data.logical_drop_id
            ? "Este recorte do inventário não inclui o identificador de drop lógico. Os demais dados refletem o cadastro disponível para a CPE."
            : undefined
      }
      onClose={onClose}
    >
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
    </EntityDetailModal>
  );
}
