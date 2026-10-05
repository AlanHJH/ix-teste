import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database';

@Controller()
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get('health')
  async health() {
    const result = await this.database.query<{ status: string; finished_at: string }>(
      "SELECT status, finished_at FROM dataset_loads WHERE dataset_key='ondaluz-2026-08'"
    );
    return { status: result.rows[0]?.status === 'complete' ? 'ok' : 'loading', dataset: result.rows[0] ?? null };
  }
}
