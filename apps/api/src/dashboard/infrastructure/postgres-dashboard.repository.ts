import { DatabaseService } from "../../database";
import type { DashboardComposition } from "../dashboard.types";
import type {
  DashboardDefinition,
  DashboardDefinitionInput,
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

  async listDashboards(userId: string): Promise<DashboardDefinition[]> {
    const result = await this.database.query<DashboardDefinition>(
      `SELECT dashboard_id, user_id, name, description, is_default,
              composition, created_at, updated_at
       FROM dashboard_definitions
       WHERE user_id = $1
       ORDER BY is_default DESC, updated_at DESC, dashboard_id ASC`,
      [userId],
    );
    return result.rows;
  }

  async getDashboard(
    userId: string,
    dashboardId: string,
  ): Promise<DashboardDefinition | null> {
    const result = await this.database.query<DashboardDefinition>(
      `SELECT dashboard_id, user_id, name, description, is_default,
              composition, created_at, updated_at
       FROM dashboard_definitions
       WHERE user_id = $1 AND dashboard_id = $2`,
      [userId, dashboardId],
    );
    return result.rows[0] ?? null;
  }

  async createDashboard(
    userId: string,
    input: DashboardDefinitionInput & { dashboard_id: string },
  ): Promise<DashboardDefinition> {
    if (input.is_default) {
      await this.database.query(
        `UPDATE dashboard_definitions SET is_default = false
         WHERE user_id = $1 AND is_default = true`,
        [userId],
      );
    }
    const result = await this.database.query<DashboardDefinition>(
      `INSERT INTO dashboard_definitions(
         dashboard_id, user_id, name, description, is_default, composition,
         created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, now(), now())
       RETURNING dashboard_id, user_id, name, description, is_default,
                 composition, created_at, updated_at`,
      [
        input.dashboard_id,
        userId,
        input.name,
        input.description,
        input.is_default ?? false,
        JSON.stringify(input.composition),
      ],
    );
    return result.rows[0];
  }

  async saveDashboard(
    userId: string,
    dashboardId: string,
    input: DashboardDefinitionInput,
  ): Promise<DashboardDefinition | null> {
    if (input.is_default) {
      await this.database.query(
        `UPDATE dashboard_definitions SET is_default = false
         WHERE user_id = $1 AND dashboard_id <> $2 AND is_default = true`,
        [userId, dashboardId],
      );
    }
    const result = await this.database.query<DashboardDefinition>(
      `UPDATE dashboard_definitions
       SET name = $3, description = $4, is_default = $5,
           composition = $6::jsonb, updated_at = now()
       WHERE user_id = $1 AND dashboard_id = $2
       RETURNING dashboard_id, user_id, name, description, is_default,
                 composition, created_at, updated_at`,
      [
        userId,
        dashboardId,
        input.name,
        input.description,
        input.is_default ?? false,
        JSON.stringify(input.composition),
      ],
    );
    return result.rows[0] ?? null;
  }

  async setDefaultDashboard(
    userId: string,
    dashboardId: string,
  ): Promise<DashboardDefinition | null> {
    const target = await this.getDashboard(userId, dashboardId);
    if (!target) return null;
    await this.database.query(
      `UPDATE dashboard_definitions SET is_default = false
       WHERE user_id = $1 AND is_default = true`,
      [userId],
    );
    const result = await this.database.query<DashboardDefinition>(
      `UPDATE dashboard_definitions
       SET is_default = true, updated_at = now()
       WHERE user_id = $1 AND dashboard_id = $2
       RETURNING dashboard_id, user_id, name, description, is_default,
                 composition, created_at, updated_at`,
      [userId, dashboardId],
    );
    return result.rows[0] ?? null;
  }
}
