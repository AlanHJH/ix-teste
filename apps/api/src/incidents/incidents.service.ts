import { Inject, Injectable } from "@nestjs/common";
import {
  INCIDENTS_REPOSITORY,
  IncidentsRepository,
} from "./application/incident-repository";
import type {
  CreateIncidentInput,
  IncidentOptionType,
  IncidentOptionsInput,
  ProposedIncidentScope,
  ResolvedIncidentScope,
  ScopeType,
} from "./domain/incident";

export type {
  CreateIncidentInput,
  IncidentOptionType,
  IncidentOptionsInput,
  ProposedIncidentScope,
  ResolvedIncidentScope,
  ScopeType,
} from "./domain/incident";

@Injectable()
export class IncidentsService {
  constructor(
    @Inject(INCIDENTS_REPOSITORY)
    private readonly repository: IncidentsRepository,
  ) {}

  options(input: IncidentOptionsInput) {
    return this.repository.options(input);
  }

  list(page: number, pageSize: number, sort: string, scopeType = "") {
    return this.repository.list(page, pageSize, sort, scopeType);
  }

  create(input: CreateIncidentInput) {
    return this.repository.create(input);
  }

  close(incidentId: string, status: "resolved") {
    return this.repository.close(incidentId, status);
  }

  resolveProposedScope(
    scope: ProposedIncidentScope,
  ): Promise<ResolvedIncidentScope> {
    return this.repository.resolveProposedScope(scope);
  }
}
