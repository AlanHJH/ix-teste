import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { TypeOrmDataSourceService } from "../infrastructure/typeorm-data-source.service";
import { DASHBOARD_REPOSITORY } from "./application/dashboard-repository";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { TypeOrmDashboardRepository } from "./infrastructure/typeorm-dashboard.repository";

@Module({
  imports: [InfrastructureModule],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    {
      provide: DASHBOARD_REPOSITORY,
      inject: [TypeOrmDataSourceService],
      useFactory: (typeOrm: TypeOrmDataSourceService) =>
        new TypeOrmDashboardRepository(typeOrm),
    },
  ],
  exports: [DashboardService],
})
export class DashboardModule {}
