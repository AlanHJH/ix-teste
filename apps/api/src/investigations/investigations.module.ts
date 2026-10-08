import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { IncidentsModule } from "../incidents/incidents.module";
import { InvestigationSchedulerService } from "./investigation-scheduler.service";
import { InvestigationsController } from "./investigations.controller";
import { InvestigationsService } from "./investigations.service";
import { OpenAIInvestigationAgent } from "./openai-investigation-agent";

@Module({
  imports: [InfrastructureModule, IncidentsModule],
  controllers: [InvestigationsController],
  providers: [
    InvestigationsService,
    OpenAIInvestigationAgent,
    InvestigationSchedulerService,
  ],
  exports: [InvestigationsService],
})
export class InvestigationsModule {}
