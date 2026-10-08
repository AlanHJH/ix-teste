import { Module } from "@nestjs/common";
import { DatabaseService } from "../database";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { InventoryController } from "./inventory.controller";
import { InventoryQueries } from "../mcp/contexts/inventory/application/inventory-queries";
import { PostgresInventoryRepository } from "../mcp/contexts/inventory/infrastructure/postgres-inventory-repository";

@Module({
  imports: [InfrastructureModule],
  controllers: [InventoryController],
  providers: [
    {
      provide: InventoryQueries,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) =>
        new InventoryQueries(new PostgresInventoryRepository(database)),
    },
  ],
  exports: [InventoryQueries],
})
export class InventoryModule {}
