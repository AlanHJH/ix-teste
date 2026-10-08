import { Module } from "@nestjs/common";
import { DatabaseService } from "../database";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { OperationsController } from "./operations.controller";
import { OperationsQueries } from "../mcp/contexts/operations/application/operations-queries";
import { PostgresOperationsRepository } from "../mcp/contexts/operations/infrastructure/postgres-operations-repository";

@Module({
  imports: [InfrastructureModule],
  controllers: [OperationsController],
  providers: [
    {
      provide: OperationsQueries,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new OperationsQueries(new PostgresOperationsRepository(database)),
    },
  ],
  exports: [OperationsQueries],
})
export class OperationsModule {}
