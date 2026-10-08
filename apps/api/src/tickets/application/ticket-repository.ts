import {
  PersistTicketCommand,
  TicketFilterKind,
  TicketFilterOption,
  TicketListQuery,
  TicketListResult,
  TicketNocQueueResult,
  TicketNocStatus,
  TicketRow,
} from "../domain/ticket";

export const TICKETS_REPOSITORY = Symbol("TICKETS_REPOSITORY");

/** Porta de persistência do contexto Atendimento. Nenhum caso de uso conhece SQL. */
export interface TicketsRepository {
  hasActiveCustomer(customerId: string): Promise<boolean>;
  hasActiveOperationalIncident(incidentId: string): Promise<boolean>;
  hasResolvedDetectedGrouping(groupingId: string): Promise<boolean>;
  create(input: PersistTicketCommand): Promise<TicketRow>;
  get(ticketId: string): Promise<TicketRow | null>;
  updateNocStatus(
    ticketId: string,
    status: Extract<TicketNocStatus, "in_progress" | "closed">,
  ): Promise<TicketRow | null>;
  listNocQueue(
    page: number,
    pageSize: number,
    sort: string,
  ): Promise<TicketNocQueueResult>;
  list(input: TicketListQuery): Promise<TicketListResult>;
  filterOptions(
    query: string,
    page: number,
    pageSize: number,
    sort: string,
    kind: TicketFilterKind | "",
  ): Promise<{ rows: TicketFilterOption[]; totalItems: number }>;
}
