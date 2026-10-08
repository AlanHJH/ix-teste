import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { DatabaseService } from "../database";
import { DIAGNOSTICS_REPOSITORY } from "./application/diagnostic-repository";
import { DiagnosticsController } from "./diagnostics.controller";
import { PostgresDiagnosticsRepository } from "./infrastructure/postgres-diagnostics.repository";
import { DiagnosticsService } from "./diagnostics.service";

@Module({
  imports: [InfrastructureModule],
  controllers: [DiagnosticsController],
  providers: [
    DiagnosticsService,
    {
      provide: DIAGNOSTICS_REPOSITORY,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new PostgresDiagnosticsRepository(database),
    },
  ],
  exports: [DiagnosticsService],
})
export class DiagnosticsModule {}
