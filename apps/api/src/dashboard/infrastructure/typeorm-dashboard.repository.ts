import type { DashboardComposition } from "../dashboard.types";
import type {
  DashboardPreference,
  DashboardRepository,
} from "../application/dashboard-repository";
import { TypeOrmDataSourceService } from "../../infrastructure/typeorm-data-source.service";
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
}
