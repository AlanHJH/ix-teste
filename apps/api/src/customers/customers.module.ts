import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";
import { N1AdvisorService } from "./n1-advisor.service";

@Module({
  imports: [InfrastructureModule],
  controllers: [CustomersController],
  providers: [CustomersService, N1AdvisorService],
  exports: [CustomersService, N1AdvisorService],
})
export class CustomersModule {}
