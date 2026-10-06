import { TicketCheck } from "lucide-react";
import { EntityDetailModal } from "./EntityDetailModal";
import type { EntityDetailItem } from "./EntityDetailModal";
import type { SupportTicket } from "./types";

const nocStatusLabel: Record<SupportTicket["noc_status"], string> = {
  not_applicable: "Não se aplica",
  pending: "Aguardando análise do NOC",
  in_progress: "Em análise pelo NOC",
  linked: "Vinculado a um incidente",
  closed: "Encerrado pelo NOC",
};

function formatDateTime(value: string | null) {
  if (!value) return "Não informado";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TicketDetailModal({
  ticket,
  onClose,
}: {
  ticket: SupportTicket;
  onClose: () => void;
}) {
  const location =
    ticket.neighborhood && ticket.city
      ? `${ticket.neighborhood} · ${ticket.city}`
      : "Não localizada no inventário atual";
  const topology =
    ticket.olt && ticket.pon && ticket.cto
      ? `${ticket.olt} · PON ${ticket.pon} · ${ticket.cto}`
      : "Não informada";
  const details: EntityDetailItem[] = [
    { label: "Cliente", value: ticket.customer_id },
    { label: "Localidade", value: location },
    { label: "Aberto em", value: formatDateTime(ticket.opened_at) },
    { label: "Encerrado em", value: formatDateTime(ticket.closed_at) },
    { label: "Canal", value: ticket.channel },
    { label: "Categoria", value: ticket.category },
    {
      label: "Tempo de atendimento",
      value:
        ticket.handling_minutes == null
          ? "Em aberto"
          : `${ticket.handling_minutes} min`,
    },
    {
      label: "Origem do registro",
      value: ticket.source === "n1" ? "Aberto pelo N1" : "Histórico importado",
    },
    {
      label: "Responsável pela abertura",
      value: ticket.opened_by ?? "Não informado",
    },
    { label: "Topologia relacionada", value: topology },
    { label: "Situação no NOC", value: nocStatusLabel[ticket.noc_status] },
    {
      label: "Incidente relacionado",
      value: ticket.related_problem_id ?? "Nenhum incidente vinculado",
    },
    { label: "Motivo relatado", value: ticket.description, wide: true },
    { label: "Resolução registrada", value: ticket.resolution, wide: true },
  ];

  return (
    <EntityDetailModal
      variant="ticket"
      icon={<TicketCheck size={22} />}
      eyebrow="Detalhes do chamado"
      title={ticket.ticket_id}
      subtitle={`${ticket.customer_id} · ${ticket.category}`}
      details={details}
      note="Os dados exibidos correspondem ao registro completo disponível para este ticket."
      onClose={onClose}
    />
  );
}
