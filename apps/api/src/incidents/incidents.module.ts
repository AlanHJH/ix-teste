import { Module } from "@nestjs/common";
import { DatabaseService } from "../database";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { INCIDENTS_REPOSITORY } from "./application/incident-repository";
import { IncidentsController } from "./incidents.controller";
import { IncidentsService } from "./incidents.service";
import { PostgresIncidentsRepository } from "./infrastructure/postgres-incidents.repository";

@Module({
  imports: [InfrastructureModule],
  controllers: [IncidentsController],
  providers: [
    IncidentsService,
    {
      provide: INCIDENTS_REPOSITORY,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new PostgresIncidentsRepository(database),
    },
  ],
  exports: [IncidentsService],
})
export class IncidentsModule {}
