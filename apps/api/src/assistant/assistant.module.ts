import { Module } from "@nestjs/common";
import { AssistantController } from "./assistant.controller";
import { IrisAssistantService } from "./iris-assistant.service";

@Module({
  controllers: [AssistantController],
  providers: [IrisAssistantService],
})
export class AssistantModule {}
