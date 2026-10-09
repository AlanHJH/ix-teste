import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { paginate } from "../pagination";
import {
  CreateTicketCommand,
  isKnownDetectedGrouping,
  isOperationalIncidentId,
  ticketCategories,
  ticketOutcomeResolution,
  TicketFilter,
  TicketFilterKind,
  TicketOutcome,
} from "./domain/ticket";
import {
  TICKETS_REPOSITORY,
  TicketsRepository,
} from "./application/ticket-repository";

export type { TicketFilter, TicketFilterKind } from "./domain/ticket";

const validCategories = new Set<string>(ticketCategories);
const validOutcomes = new Set<string>(Object.keys(ticketOutcomeResolution));

/**
 * Camada de aplicação do bounded context Atendimento.
 *
 * Coordena casos de uso e regras de transição, mas não conhece SQL. A porta
 * TicketsRepository permite trocar PostgreSQL por um fake em testes ou por
 * outro adaptador sem alterar o contrato HTTP/MCP.
 */
@Injectable()
export class TicketsService {
  constructor(
    @Inject(TICKETS_REPOSITORY)
    private readonly repository: TicketsRepository,
  ) {}

  async create(input: CreateTicketCommand) {
    const customerId = input.customerId.trim().toUpperCase();
    const openedBy = input.openedBy.trim();
    const description = input.description.trim();
    if (openedBy.length < 2 || openedBy.length > 100) {
      throw new BadRequestException("Informe o responsável pelo atendimento.");
    }
    if (!validCategories.has(input.category)) {
      throw new BadRequestException("Selecione uma categoria técnica válida.");
    }
    if (description.length < 10 || description.length > 600) {
      throw new BadRequestException(
        "Descreva o relato do cliente em 10 a 600 caracteres.",
      );
    }
    if (!validOutcomes.has(input.outcome)) {
      throw new BadRequestException("Selecione um encaminhamento válido.");
    }

    const relatedProblemId = input.relatedProblemId;
    const incidentId = relatedProblemId ?? "";
    if (
      relatedProblemId &&
      !isKnownDetectedGrouping(relatedProblemId) &&
      !isOperationalIncidentId(incidentId)
    ) {
      throw new BadRequestException("Problema relacionado inválido.");
    }

    if (
      relatedProblemId &&
      isOperationalIncidentId(incidentId) &&
      !(await this.repository.hasActiveOperationalIncident(incidentId))
    ) {
      throw new BadRequestException("Incidente relacionado não está ativo.");
    }

    if (
      relatedProblemId &&
      isKnownDetectedGrouping(relatedProblemId) &&
      (await this.repository.hasResolvedDetectedGrouping(relatedProblemId))
    ) {
      throw new BadRequestException("Agrupamento relacionado não está ativo.");
    }

    if (!(await this.repository.hasActiveCustomer(customerId))) {
      throw new NotFoundException("Cliente ativo não encontrado.");
    }

    const outcome = input.outcome as TicketOutcome;
    return this.repository.create({
      ticketId: `TN1-${randomUUID().slice(0, 8).toUpperCase()}`,
      customerId,
      openedBy,
      category: input.category,
      description,
      outcome,
      resolution: ticketOutcomeResolution[outcome],
      relatedProblemId,
      sourcePayload: input.sourcePayload ?? {
        customer_id: customerId,
        opened_by: openedBy,
        category: input.category,
        description,
        outcome,
        related_problem_id: relatedProblemId,
      },
    });
  }

  async nocQueue(page: number, pageSize: number, sort: string) {
    const result = await this.repository.listNocQueue(page, pageSize, sort);
    return paginate(result.rows, result.total, page, pageSize, {
      summary: {
        received: result.received,
        inProgress: result.inProgress,
      },
    });
  }

  async get(ticketId: string) {
    const ticket = await this.repository.get(ticketId.trim().toUpperCase());
    if (!ticket) throw new NotFoundException("Chamado não encontrado.");
    return ticket;
  }

  async updateNocStatus(
    ticketId: string,
    status: Extract<"in_progress" | "closed", string>,
  ) {
    if (status !== "in_progress" && status !== "closed") {
      throw new BadRequestException("Transição de estado do NOC inválida.");
    }
    const ticket = await this.repository.updateNocStatus(
      ticketId.trim().toUpperCase(),
      status,
    );
    if (!ticket) {
      throw new NotFoundException(
        status === "closed"
          ? "Chamado não encontrado ou já saiu da coluna em andamento."
          : "Chamado não encontrado ou já saiu da coluna de recebidos.",
      );
    }
    return ticket;
  }

  async list(input: Parameters<TicketsRepository["list"]>[0]) {
    const result = await this.repository.list(input);
    return paginate(
      result.rows,
      result.summary.total,
      input.page,
      input.pageSize,
      { summary: result.summary, filters: result.filters },
    );
  }

  async filterOptions(
    query: string,
    page: number,
    pageSize: number,
    sort: string,
    kind: TicketFilterKind | "" = "",
  ) {
    const result = await this.repository.filterOptions(
      query,
      page,
      pageSize,
      sort,
      kind,
    );
    return paginate(result.rows, result.totalItems, page, pageSize);
  }
}

export type { CreateTicketCommand };
