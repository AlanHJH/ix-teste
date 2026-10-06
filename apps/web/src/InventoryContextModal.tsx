import { Gauge, Radio, UserRound } from "lucide-react";
import { EntityDetailModal } from "./EntityDetailModal";
import type { EntityDetailItem } from "./EntityDetailModal";
import { providerGlossary } from "./ProviderGlossary";
import type { InventoryRecord } from "./types";

export type InventoryContext =
  | { kind: "customer"; item: InventoryRecord }
  | { kind: "firmware"; item: InventoryRecord }
  | { kind: "plan"; item: InventoryRecord };

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });

function formattedDate(value: string | null) {
  if (!value) return "Não informado";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : date.format(parsed);
}

export function InventoryContextModal({
  context,
  canOpenSupport,
  onOpenSupport,
  onClose,
}: {
  context: InventoryContext;
  canOpenSupport: boolean;
  onOpenSupport: (customerId: string) => void;
  onClose: () => void;
}) {
  const { item } = context;
  let icon = <UserRound size={22} />;
  let eyebrow = "Cliente do inventário";
  let title = item.customer_id;
  let subtitle = `${item.neighborhood} · ${item.city}`;
  let note = "Resumo cadastral disponível neste recorte do inventário.";
  let details: EntityDetailItem[] = [
    {
      label: "Situação",
      value: item.status === "active" ? "Ativo" : "Removido",
    },
    {
      label: "CPE atual",
      value: item.serial,
      hint: providerGlossary.cpe.description,
    },
    {
      label: "Equipamento",
      value: `${item.vendor} ${item.model} · rev. ${item.hw_revision}`,
      hint: providerGlossary.hardware.description,
    },
    { label: "Plano contratado", value: `${item.plan_mbps} Mbps` },
    {
      label: "Topologia",
      value: `${item.olt} · PON ${item.pon_port} · ${item.cto}`,
      hint: providerGlossary.logicalTopology.description,
    },
    { label: "Instalado em", value: formattedDate(item.installed_at) },
  ];

  if (context.kind === "firmware") {
    icon = <Radio size={22} />;
    eyebrow = "Software do equipamento";
    title = `Firmware ${item.software_version}`;
    subtitle = `${item.vendor} ${item.model} · ${item.serial}`;
    note =
      "O inventário informa a versão instalada, mas não confirma sozinho estabilidade, atualização disponível ou necessidade de intervenção.";
    details = [
      { label: "Versão instalada", value: item.software_version },
      { label: "Fabricante", value: item.vendor },
      { label: "Modelo", value: item.model },
      { label: "Revisão de hardware", value: item.hw_revision },
      {
        label: "CPE",
        value: item.serial,
        hint: providerGlossary.cpe.description,
      },
      { label: "Cliente", value: item.customer_id },
    ];
  } else if (context.kind === "plan") {
    icon = <Gauge size={22} />;
    eyebrow = "Plano contratado";
    title = `${item.plan_mbps} Mbps`;
    subtitle = `Cliente ${item.customer_id}`;
    note =
      "O plano representa a velocidade contratada. A entrega observada depende também da interface LAN, do Wi-Fi, do sinal óptico e do dispositivo do cliente.";
    details = [
      { label: "Plano atual", value: `${item.plan_mbps} Mbps` },
      {
        label: "Plano anterior",
        value: item.previous_plan_mbps
          ? `${item.previous_plan_mbps} Mbps`
          : "Não informado",
      },
      { label: "Vigente desde", value: formattedDate(item.plan_since) },
      {
        label: "Equipamento",
        value: `${item.vendor} ${item.model} · rev. ${item.hw_revision}`,
      },
      {
        label: "CPE",
        value: item.serial,
        hint: providerGlossary.cpe.description,
      },
      { label: "Cliente", value: item.customer_id },
    ];
  }

  return (
    <EntityDetailModal
      variant={context.kind}
      icon={icon}
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      details={details}
      note={note}
      onClose={onClose}
    >
      {context.kind === "customer" && (
        <div className="entity-modal-children inventory-customer-action">
          <div>
            <span>Próximo passo</span>
            <p>
              {canOpenSupport
                ? "Abra o atendimento com este cliente já selecionado."
                : "O atendimento N1 está disponível para os perfis Admin e N1."}
            </p>
          </div>
          <button
            type="button"
            disabled={!canOpenSupport || item.status !== "active"}
            onClick={() => {
              onOpenSupport(item.customer_id);
              onClose();
            }}
          >
            <UserRound size={16} aria-hidden="true" />
            Abrir no N1
          </button>
        </div>
      )}
    </EntityDetailModal>
  );
}
