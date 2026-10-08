import { DatabaseService } from "../../database";
import type { DashboardComposition } from "../dashboard.types";
import type {
  DashboardPreference,
  DashboardRepository,
} from "../application/dashboard-repository";

export class PostgresDashboardRepository implements DashboardRepository {
  constructor(private readonly database: DatabaseService) {}

  async getPreference(userId: string): Promise<DashboardPreference | null> {
    const result = await this.database.query<DashboardPreference>(
      `SELECT composition, updated_at
       FROM dashboard_preferences
       WHERE user_id = $1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async savePreference(
    userId: string,
    composition: DashboardComposition,
  ): Promise<{ updated_at: Date | string }> {
    const result = await this.database.query<{ updated_at: Date | string }>(
      `INSERT INTO dashboard_preferences(user_id, composition, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (user_id) DO UPDATE
       SET composition = EXCLUDED.composition, updated_at = now()
       RETURNING updated_at`,
      [userId, JSON.stringify(composition)],
    );
    return result.rows[0];
  }
}
