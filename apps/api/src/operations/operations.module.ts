import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { OperationsController } from "./operations.controller";

@Module({
  imports: [InfrastructureModule],
  controllers: [OperationsController],
})
export class OperationsModule {}
