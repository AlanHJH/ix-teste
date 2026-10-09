import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { DatabaseService } from "../database";

@Injectable()
export class TelemetryAggregationService
  implements OnModuleInit, OnModuleDestroy
{
  private dirty = false;
  private running = false;
  private timer?: NodeJS.Timeout;

  constructor(private readonly database: DatabaseService) {}

  onModuleInit(): void {
    const intervalMs = Math.max(
      30_000,
      Number(process.env.TELEMETRY_AGGREGATION_INTERVAL_MS ?? 60_000),
    );
    this.timer = setInterval(() => {
      void this.refreshIfDirty();
    }, intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  markDirty(): void {
    this.dirty = true;
  }

  async refreshIfDirty(): Promise<void> {
    if (!this.dirty || this.running) return;
    this.running = true;
    try {
      await this.database.query("REFRESH MATERIALIZED VIEW daily_cpe_metrics");
      this.dirty = false;
    } finally {
      this.running = false;
    }
  }
}
