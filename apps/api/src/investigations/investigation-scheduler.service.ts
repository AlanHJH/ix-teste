import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { InvestigationsService } from "./investigations.service";

@Injectable()
export class InvestigationSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly timers: NodeJS.Timeout[] = [];

  constructor(private readonly investigations: InvestigationsService) {}

  onModuleInit(): void {
    void this.investigations.recoverQueued();
    if (process.env.AGENT_SCHEDULE_ENABLED === "true") {
      this.addTimer(
        Number(process.env.AGENT_SCHEDULE_INTERVAL_MS ?? 3_600_000),
        () => this.investigations.triggerScheduled(),
      );
    }
    if (process.env.AGENT_METRIC_TRIGGER_ENABLED === "true") {
      this.addTimer(
        Number(process.env.AGENT_METRIC_TRIGGER_INTERVAL_MS ?? 300_000),
        () => this.investigations.triggerMetricCandidates(),
      );
    }
  }

  onModuleDestroy(): void {
    this.timers.forEach((timer) => clearInterval(timer));
  }

  private addTimer(intervalMs: number, task: () => Promise<unknown>): void {
    const safeInterval = Math.max(60_000, intervalMs);
    const timer = setInterval(() => {
      void task().catch((error) =>
        console.error("[agent-scheduler] Falha ao criar investigação", error),
      );
    }, safeInterval);
    timer.unref();
    this.timers.push(timer);
  }
}
