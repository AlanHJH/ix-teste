import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { InvestigationsModule } from "../investigations/investigations.module";
import { TicketsModule } from "../tickets/tickets.module";
import { DataLabController } from "./data-lab.controller";
import { DataLabService } from "./data-lab.service";

@Module({
  imports: [InfrastructureModule, InvestigationsModule, TicketsModule],
  controllers: [DataLabController],
  providers: [DataLabService],
})
export class DataLabModule {}
