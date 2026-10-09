import { Module } from "@nestjs/common";
import { CustomersModule } from "./customers/customers.module";
import { DataLabModule } from "./data-lab/data-lab.module";
import { AuthModule } from "./auth/auth.module";
import { AssistantModule } from "./assistant/assistant.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DiagnosticsModule } from "./diagnostics/diagnostics.module";
import { IncidentsModule } from "./incidents/incidents.module";
import { InfrastructureModule } from "./infrastructure/infrastructure.module";
import { InvestigationsModule } from "./investigations/investigations.module";
import { InventoryModule } from "./inventory/inventory.module";
import { McpModule } from "./mcp/mcp.module";
import { NetworkModule } from "./network/network.module";
import { OperationsModule } from "./operations/operations.module";
import { SystemModule } from "./system/system.module";
import { TelemetryModule } from "./telemetry/telemetry.module";
import { TicketsModule } from "./tickets/tickets.module";
import { RealtimeModule } from "./realtime/realtime.module";

@Module({
  imports: [
    AuthModule,
    AssistantModule,
    InfrastructureModule,
    SystemModule,
    CustomersModule,
    DataLabModule,
    TicketsModule,
    DiagnosticsModule,
    NetworkModule,
    InventoryModule,
    TelemetryModule,
    OperationsModule,
    IncidentsModule,
    InvestigationsModule,
    DashboardModule,
    McpModule,
    RealtimeModule,
  ],
})
export class AppModule {}
