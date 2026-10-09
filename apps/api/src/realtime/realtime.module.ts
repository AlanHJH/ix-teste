import { Global, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ScreenUpdatesGateway } from "./screen-updates.gateway";
import { ScreenUpdatesService } from "./screen-updates.service";

@Global()
@Module({
  imports: [AuthModule],
  providers: [ScreenUpdatesService, ScreenUpdatesGateway],
  exports: [ScreenUpdatesService],
})
export class RealtimeModule {}
