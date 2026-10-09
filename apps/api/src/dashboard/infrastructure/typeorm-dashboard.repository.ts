import type { DashboardComposition } from "../dashboard.types";
import type {
  DashboardDefinition,
  DashboardDefinitionInput,
  DashboardPreference,
  DashboardRepository,
} from "../application/dashboard-repository";
import { TypeOrmDataSourceService } from "../../infrastructure/typeorm-data-source.service";
import { DashboardDefinitionEntity } from "./typeorm/dashboard-definition.entity";
import { DashboardPreferenceEntity } from "./typeorm/dashboard-preference.entity";

/**
 * Adapter ORM do contexto Dashboard.
 *
 * O adapter conhece somente a tabela do seu contexto. O contrato exposto à
 * aplicação continua sendo o mesmo do repositório PostgreSQL anterior.
 */
export class TypeOrmDashboardRepository implements DashboardRepository {
  constructor(private readonly typeOrm: TypeOrmDataSourceService) {}

  async getPreference(userId: string): Promise<DashboardPreference | null> {
    const dataSource = await this.typeOrm.getDataSource();
    const row = await dataSource
      .getRepository(DashboardPreferenceEntity)
      .findOne({
        where: { userId },
      });
    if (!row) return null;
    return {
      composition: row.composition,
      updated_at: row.updatedAt,
    };
  }

  async savePreference(
    userId: string,
    composition: DashboardComposition,
  ): Promise<{ updated_at: Date | string }> {
    const dataSource = await this.typeOrm.getDataSource();
    const result = await dataSource
      .createQueryBuilder()
      .insert()
      .into(DashboardPreferenceEntity)
      .values({
        userId,
        composition,
        updatedAt: () => "now()",
      })
      .orUpdate(["composition", "updated_at"], ["user_id"])
      .returning(["updated_at"])
      .execute();

    return { updated_at: result.raw[0].updated_at };
  }

  async listDashboards(userId: string): Promise<DashboardDefinition[]> {
    const dataSource = await this.typeOrm.getDataSource();
    const rows = await dataSource
      .getRepository(DashboardDefinitionEntity)
      .find({
        where: { userId },
        order: { isDefault: "DESC", updatedAt: "DESC", dashboardId: "ASC" },
      });
    return rows.map((row) => this.toDefinition(row));
  }

  async getDashboard(
    userId: string,
    dashboardId: string,
  ): Promise<DashboardDefinition | null> {
    const dataSource = await this.typeOrm.getDataSource();
    const row = await dataSource
      .getRepository(DashboardDefinitionEntity)
      .findOne({ where: { userId, dashboardId } });
    return row ? this.toDefinition(row) : null;
  }

  async createDashboard(
    userId: string,
    input: DashboardDefinitionInput & { dashboard_id: string },
  ): Promise<DashboardDefinition> {
    const dataSource = await this.typeOrm.getDataSource();
    return dataSource.transaction(async (manager) => {
      if (input.is_default) {
        await manager.update(
          DashboardDefinitionEntity,
          { userId, isDefault: true },
          { isDefault: false },
        );
      }
      await manager
        .createQueryBuilder()
        .insert()
        .into(DashboardDefinitionEntity)
        .values({
          dashboardId: input.dashboard_id,
          userId,
          name: input.name,
          description: input.description,
          isDefault: input.is_default ?? false,
          composition: input.composition,
          createdAt: () => "now()",
          updatedAt: () => "now()",
        })
        .execute();
      const row = await manager.findOneByOrFail(DashboardDefinitionEntity, {
        dashboardId: input.dashboard_id,
      });
      return this.toDefinition(row);
    });
  }

  async saveDashboard(
    userId: string,
    dashboardId: string,
    input: DashboardDefinitionInput,
  ): Promise<DashboardDefinition | null> {
    const dataSource = await this.typeOrm.getDataSource();
    return dataSource.transaction(async (manager) => {
      if (input.is_default) {
        await manager
          .createQueryBuilder()
          .update(DashboardDefinitionEntity)
          .set({ isDefault: false })
          .where("user_id = :userId AND dashboard_id <> :dashboardId", {
            userId,
            dashboardId,
          })
          .execute();
      }
      const result = await manager
        .createQueryBuilder()
        .update(DashboardDefinitionEntity)
        .set({
          name: input.name,
          description: input.description,
          isDefault: input.is_default ?? false,
          composition: input.composition,
          updatedAt: () => "now()",
        })
        .where("user_id = :userId AND dashboard_id = :dashboardId", {
          userId,
          dashboardId,
        })
        .returning("*")
        .execute();
      if (!result.affected) return null;
      const row = await manager.findOne(DashboardDefinitionEntity, {
        where: { userId, dashboardId },
      });
      return row ? this.toDefinition(row) : null;
    });
  }

  async setDefaultDashboard(
    userId: string,
    dashboardId: string,
  ): Promise<DashboardDefinition | null> {
    const dataSource = await this.typeOrm.getDataSource();
    return dataSource.transaction(async (manager) => {
      const target = await manager.findOne(DashboardDefinitionEntity, {
        where: { userId, dashboardId },
      });
      if (!target) return null;
      await manager.update(
        DashboardDefinitionEntity,
        { userId, isDefault: true },
        { isDefault: false },
      );
      const result = await manager
        .createQueryBuilder()
        .update(DashboardDefinitionEntity)
        .set({ isDefault: true, updatedAt: () => "now()" })
        .where("user_id = :userId AND dashboard_id = :dashboardId", {
          userId,
          dashboardId,
        })
        .returning("*")
        .execute();
      if (!result.affected) return null;
      const row = await manager.findOne(DashboardDefinitionEntity, {
        where: { userId, dashboardId },
      });
      return row ? this.toDefinition(row) : null;
    });
  }

  private toDefinition(row: DashboardDefinitionEntity): DashboardDefinition {
    return {
      dashboard_id: row.dashboardId,
      user_id: row.userId,
      name: row.name,
      description: row.description,
      is_default: row.isDefault,
      composition: row.composition,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }
}
