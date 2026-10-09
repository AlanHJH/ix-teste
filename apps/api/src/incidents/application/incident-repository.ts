import type {
  CreateIncidentInput,
  IncidentStatus,
  IncidentOptionsInput,
  ProposedIncidentScope,
  ResolvedIncidentScope,
} from "../domain/incident";

export const INCIDENTS_REPOSITORY = Symbol("INCIDENTS_REPOSITORY");

export interface IncidentsRepository {
  options(input: IncidentOptionsInput): Promise<unknown>;
  list(
    page: number,
    pageSize: number,
    sort: string,
    scopeType?: string,
  ): Promise<unknown>;
  create(input: CreateIncidentInput): Promise<unknown>;
  updateStatus(
    incidentId: string,
    status: Exclude<IncidentStatus, "resolved">,
  ): Promise<unknown>;
  close(incidentId: string, status: "resolved"): Promise<unknown>;
  resolveProposedScope(
    scope: ProposedIncidentScope,
  ): Promise<ResolvedIncidentScope>;
}
