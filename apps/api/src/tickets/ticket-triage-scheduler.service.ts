import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { TicketTriageService } from "./ticket-triage.service";

@Injectable()
export class TicketTriageSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly triage: TicketTriageService) {}

  onModuleInit(): void {
    if (
      process.env.TICKET_TRIAGE_SCHEDULE_ENABLED === "false" ||
      !this.triage.isConfigured()
    ) {
      return;
    }
    const configuredInterval = Number(
      process.env.TICKET_TRIAGE_INTERVAL_MS ?? 900_000,
    );
    const intervalMs = Number.isFinite(configuredInterval)
      ? Math.max(60_000, Math.min(86_400_000, configuredInterval))
      : 900_000;
    this.timer = setInterval(() => {
      void this.triage
        .runPending()
        .catch((error) =>
          console.error("[ticket-triage] Falha na execução agendada", error),
        );
    }, intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
