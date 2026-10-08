import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { InventoryController } from "./inventory.controller";

@Module({
  imports: [InfrastructureModule],
  controllers: [InventoryController],
})
export class InventoryModule {}
