import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { DiagnosticsController } from "./diagnostics.controller";
import { DiagnosticsService } from "./diagnostics.service";

@Module({
  imports: [InfrastructureModule],
  controllers: [DiagnosticsController],
  providers: [DiagnosticsService],
  exports: [DiagnosticsService],
})
export class DiagnosticsModule {}
