import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { IncomingMessage, ServerResponse } from "node:http";
import { DatabaseService } from "./database";
import { createMcpGateway, McpGateway } from "./mcp/gateway";
import { NetworkService } from "./network/network.service";
import { CustomersService } from "./customers/customers.service";
import { N1AdvisorService } from "./customers/n1-advisor.service";
import { TicketsService } from "./tickets/tickets.service";
import { IncidentsService } from "./incidents/incidents.service";
import { InvestigationsService } from "./investigations/investigations.service";
import { DashboardService } from "./dashboard/dashboard.service";
import { paginate } from "./pagination";
import { CreateIncidentInput } from "./incidents/incidents.service";
import { OpenApiCatalogService } from "./openapi-catalog.service";
import { TicketTriageService } from "./tickets/ticket-triage.service";

@Injectable()
export class McpGatewayService implements OnModuleDestroy {
  private readonly gateway: McpGateway;

  constructor(
    database: DatabaseService,
    network: NetworkService,
    customers: CustomersService,
    n1Advisor: N1AdvisorService,
    tickets: TicketsService,
    ticketTriage: TicketTriageService,
    incidents: IncidentsService,
    investigations: InvestigationsService,
    dashboard: DashboardService,
    openApiCatalog: OpenApiCatalogService,
  ) {
    const allowedHosts = (
      process.env.MCP_ALLOWED_HOSTS ?? "localhost,127.0.0.1,::1,api"
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const restBaseUrl =
      process.env.INTERNAL_REST_BASE_URL ??
      `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
    this.gateway = createMcpGateway(
      database,
      { allowedHosts },
      {
        health: async () => {
          const result = await database.query<{
            status: string;
            finished_at: string;
          }>(
            "SELECT status, finished_at FROM dataset_loads WHERE dataset_key='ondaluz-2026-08'",
          );
          return {
            status: result.rows[0]?.status === "complete" ? "ok" : "loading",
            service: "ondaluz-api",
            interfaces: { rest: "/api", mcp: "/mcp" },
            dataset: result.rows[0] ?? null,
          };
        },
        overview: () => network.getOverview(),
        topology: (olt, pon) => network.getTopology(olt, pon),
        topologyPath: async (input) => {
          const result = await network.findTopologyPath(
            input.query,
            input.page,
            input.pageSize,
            input.sort,
          );
          return paginate(
            result.data,
            result.totalItems,
            input.page,
            input.pageSize,
          );
        },
        topologyDevices: async (input) => {
          const result = await network.getTopologyDevices(
            input.olt,
            input.pon,
            input.cto,
            input.page,
            input.pageSize,
            input.sort,
          );
          return paginate(
            result.data,
            result.totalItems,
            input.page,
            input.pageSize,
          );
        },
        detectedGroupings: async (input) => {
          const all = await network.getIncidents();
          const sorted = [...all].sort((left, right) => {
            if (input.sort === "affected_desc") {
              return right.affected - left.affected;
            }
            if (input.sort === "title_asc") {
              return left.title.localeCompare(right.title, "pt-BR");
            }
            return right.score - left.score;
          });
          const offset = (input.page - 1) * input.pageSize;
          return paginate(
            sorted.slice(offset, offset + input.pageSize),
            sorted.length,
            input.page,
            input.pageSize,
          );
        },
        detectedGrouping: async (id) => {
          const grouping = (await network.getIncidents()).find(
            (item) => item.id === id,
          );
          if (!grouping) throw new Error("Agrupamento não encontrado.");
          return grouping;
        },
        closeDetectedGrouping: (id) =>
          network.closeDetectedGrouping(id, "resolved"),
        customerSupport: (customerId) =>
          customers.getSupportProfile(customerId),
        customerFilterOptions: (input) =>
          customers.filterOptions(
            input.query,
            input.status,
            input.page,
            input.pageSize,
            input.sort,
          ),
        n1Chat: (input) =>
          n1Advisor.chat(input.customerId, input.message, input.history),
        nocQueue: (input) =>
          tickets.nocQueue(input.page, input.pageSize, input.sort),
        ticketTriage: (ticketId) => ticketTriage.listRuns(ticketId),
        ticketTriageConfig: () => ticketTriage.config(),
        retryTicketTriage: (ticketId) => ticketTriage.retry(ticketId),
        createTicket: (input) => tickets.create(input as never),
        updateTicketStatus: (ticketId, status, closure) =>
          tickets.updateNocStatus(ticketId, status, closure),
        activeIncidents: (input) =>
          incidents.list(
            input.page,
            input.pageSize,
            input.sort,
            input.scopeType,
          ),
        incidentOptions: (input) => incidents.options(input),
        createIncident: (input) =>
          incidents.create(input as unknown as CreateIncidentInput),
        closeIncident: (incidentId) => incidents.close(incidentId, "resolved"),
        investigations: (input) =>
          investigations.list(
            input.page,
            input.pageSize,
            input.sort,
            input.status,
          ),
        investigationConfig: () => investigations.config(),
        triggerInvestigations: (kind, objective) => {
          if (kind === "manual") {
            return investigations.triggerManual(objective ?? "");
          }
          if (kind === "scheduled") {
            return investigations.triggerScheduled();
          }
          return investigations.triggerMetricCandidates();
        },
        retryInvestigation: (investigationId) =>
          investigations.retry(investigationId),
        reviewInvestigation: (input) =>
          investigations.review(
            input.investigationId,
            input.decision,
            input.reviewer,
            input.note,
          ),
        composeDashboard: (input) => dashboard.compose(input),
        dashboardPreference: (userId) => dashboard.getPreference(userId),
        saveDashboardPreference: (userId, composition) =>
          dashboard.savePreference(userId, composition),
      },
      {
        document: () => openApiCatalog.getDocument(),
        bridge: { baseUrl: restBaseUrl },
      },
    );
  }

  handle(request: IncomingMessage, response: ServerResponse) {
    return this.gateway.handle(request, response);
  }

  async onModuleDestroy(): Promise<void> {
    await this.gateway.close();
  }
}
