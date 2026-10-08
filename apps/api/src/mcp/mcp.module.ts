import { Module } from "@nestjs/common";
import { CustomersModule } from "../customers/customers.module";
import { DashboardModule } from "../dashboard/dashboard.module";
import { IncidentsModule } from "../incidents/incidents.module";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { InvestigationsModule } from "../investigations/investigations.module";
import { NetworkModule } from "../network/network.module";
import { TicketsModule } from "../tickets/tickets.module";
import { McpGatewayService } from "../mcp-gateway.service";

/**
 * Adaptador de integração. O MCP pode orquestrar casos de uso exportados,
 * mas não transforma o gateway em dependência dos contextos de negócio.
 */
@Module({
  imports: [
    InfrastructureModule,
    NetworkModule,
    CustomersModule,
    TicketsModule,
    IncidentsModule,
    InvestigationsModule,
    DashboardModule,
  ],
  providers: [McpGatewayService],
})
export class McpModule {}
