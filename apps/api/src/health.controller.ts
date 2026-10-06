import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseService } from "./database";

@Controller()
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get("health")
  async health() {
    const result = await this.database.query<{
      status: string;
      finished_at: string;
    }>(
      "SELECT status, finished_at FROM dataset_loads WHERE dataset_key='ondaluz-2026-08'",
    );
    const dataset = result.rows[0] ?? null;
    if (dataset?.status !== "complete") {
      throw new ServiceUnavailableException({ status: "loading", dataset });
    }
    return {
      status: "ok",
      service: "ondaluz-api",
      interfaces: { rest: "/api", mcp: "/mcp" },
      dataset,
    };
  }
}
