import { Module } from "@nestjs/common";
import { CatalogController } from "../catalog.controller";
import { HealthController } from "../health.controller";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";

@Module({
  imports: [InfrastructureModule],
  controllers: [HealthController, CatalogController],
})
export class SystemModule {}
