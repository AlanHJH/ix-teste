import { TicketQuery, TicketRepository } from "../domain/ticket-repository.js";

export class TicketQueries {
  constructor(private readonly repository: TicketRepository) {}

  list(input: TicketQuery) {
    return this.repository.list(input);
  }

  async get(ticketId: string) {
    const ticket = await this.repository.findById(ticketId.trim());
    if (!ticket) throw new Error("Chamado não encontrado.");
    return ticket;
  }
}
