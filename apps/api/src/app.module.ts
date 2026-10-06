import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { DatabaseService } from "./database";
import { NetworkController } from "./network/network.controller";
import { NetworkService } from "./network/network.service";
import { CustomersController } from "./customers/customers.controller";
import { CustomersService } from "./customers/customers.service";
import { N1AdvisorService } from "./customers/n1-advisor.service";
import { TicketsController } from "./tickets/tickets.controller";
import { TicketsService } from "./tickets/tickets.service";
import { DiagnosticsController } from "./diagnostics/diagnostics.controller";
import { DiagnosticsService } from "./diagnostics/diagnostics.service";
import { CatalogController } from "./catalog.controller";
import { McpGatewayService } from "./mcp-gateway.service";
import { InvestigationsController } from "./investigations/investigations.controller";
import { InvestigationsService } from "./investigations/investigations.service";
import { OpenAIInvestigationAgent } from "./investigations/openai-investigation-agent";
import { InvestigationSchedulerService } from "./investigations/investigation-scheduler.service";
import { IncidentsController } from "./incidents/incidents.controller";
import { IncidentsService } from "./incidents/incidents.service";
import { DashboardController } from "./dashboard/dashboard.controller";
import { DashboardService } from "./dashboard/dashboard.service";
import { InventoryController } from "./inventory/inventory.controller";
import { TelemetryController } from "./telemetry/telemetry.controller";
import { OperationsController } from "./operations/operations.controller";
import { OpenApiCatalogService } from "./openapi-catalog.service";

@Module({
  controllers: [
    HealthController,
    NetworkController,
    CustomersController,
    TicketsController,
    DiagnosticsController,
    InvestigationsController,
    IncidentsController,
    DashboardController,
    InventoryController,
    TelemetryController,
    OperationsController,
    CatalogController,
  ],
  providers: [
    DatabaseService,
    NetworkService,
    CustomersService,
    N1AdvisorService,
    TicketsService,
    DiagnosticsService,
    InvestigationsService,
    IncidentsService,
    DashboardService,
    OpenAIInvestigationAgent,
    InvestigationSchedulerService,
    McpGatewayService,
    OpenApiCatalogService,
  ],
})
export class AppModule {}
