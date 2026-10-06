import { Page, PageRequest } from "../../../shared/domain/page.js";

export type TicketQuery = PageRequest & {
  query: string;
  customerId?: string;
  category?: string;
  resolution?: string;
  channel?: string;
  from?: string;
  to?: string;
};

export interface TicketRepository {
  list(input: TicketQuery): Promise<Page<Record<string, unknown>>>;
  findById(ticketId: string): Promise<Record<string, unknown> | null>;
}
