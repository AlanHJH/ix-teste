import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { NetworkController } from "./network.controller";
import { NetworkService } from "./network.service";

@Module({
  imports: [InfrastructureModule],
  controllers: [NetworkController],
  providers: [NetworkService],
  exports: [NetworkService],
})
export class NetworkModule {}
