import { Module } from "@nestjs/common";
import { DatabaseService } from "../database";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { TelemetryController } from "./telemetry.controller";
import { TelemetryQueries } from "../mcp/contexts/telemetry/application/telemetry-queries";
import { PostgresTelemetryRepository } from "../mcp/contexts/telemetry/infrastructure/postgres-telemetry-repository";
import { TelemetryAggregationService } from "./telemetry-aggregation.service";
import { TelemetryIngestionService } from "./telemetry-ingestion.service";
import { TelemetryKafkaService } from "./telemetry-kafka.service";

@Module({
  imports: [InfrastructureModule],
  controllers: [TelemetryController],
  providers: [
    TelemetryAggregationService,
    TelemetryIngestionService,
    TelemetryKafkaService,
    {
      provide: TelemetryQueries,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new TelemetryQueries(new PostgresTelemetryRepository(database)),
    },
  ],
  exports: [TelemetryQueries, TelemetryIngestionService, TelemetryKafkaService],
})
export class TelemetryModule {}
