import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { DatabaseService } from "../database";
import { TICKETS_REPOSITORY } from "./application/ticket-repository";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";
import { PostgresTicketsRepository } from "./infrastructure/postgres-tickets.repository";

/**
 * Bounded context piloto: Atendimento/Tickets.
 *
 * O controller é a entrada HTTP, o service é a aplicação do caso de uso e o
 * regras e tipos do chamado vivem em domain/, a coordenação dos casos de uso
 * fica em TicketsService e o PostgreSQL implementa a porta em infrastructure/.
 */
@Module({
  imports: [InfrastructureModule],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    {
      provide: TICKETS_REPOSITORY,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new PostgresTicketsRepository(database),
    },
  ],
  exports: [TicketsService],
})
export class TicketsModule {}
