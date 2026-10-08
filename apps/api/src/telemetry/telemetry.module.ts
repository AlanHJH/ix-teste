import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { TelemetryController } from "./telemetry.controller";

@Module({
  imports: [InfrastructureModule],
  controllers: [TelemetryController],
})
export class TelemetryModule {}
