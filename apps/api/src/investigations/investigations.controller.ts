import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { InvestigationsService } from "./investigations.service";

@Controller("investigations")
export class InvestigationsController {
  constructor(private readonly investigations: InvestigationsService) {}

  @Get()
  list() {
    return this.investigations.list();
  }

  @Get("config")
  config() {
    return this.investigations.config();
  }

  @Post("trigger/metrics")
  triggerMetrics() {
    return this.investigations.triggerMetricCandidates();
  }

  @Post("trigger/scheduled")
  triggerScheduled() {
    return this.investigations.triggerScheduled();
  }

  @Post("trigger/manual")
  triggerManual(@Body() body: { objective?: string }) {
    return this.investigations.triggerManual(body.objective ?? "");
  }

  @Post(":investigationId/retry")
  retry(@Param("investigationId") investigationId: string) {
    return this.investigations.retry(investigationId);
  }

  @Patch(":investigationId/review")
  review(
    @Param("investigationId") investigationId: string,
    @Body()
    body: {
      decision?: "approve" | "reject";
      reviewer?: string;
      note?: string;
    },
  ) {
    if (body.decision !== "approve" && body.decision !== "reject") {
      throw new BadRequestException("Decisão deve ser approve ou reject.");
    }
    return this.investigations.review(
      investigationId,
      body.decision,
      body.reviewer ?? "",
      body.note ?? "",
    );
  }
}
