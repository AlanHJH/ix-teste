import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { DataSource } from "typeorm";
import { DashboardPreferenceEntity } from "../dashboard/infrastructure/typeorm/dashboard-preference.entity";

const defaultDatabaseUrl =
  "postgresql://ondaluz:ondaluz@localhost:5432/ondaluz";

/**
 * Porta compartilhada para o TypeORM.
 *
 * A conexão é inicializada sob demanda para preservar o comportamento atual
 * da API: subir o processo não exige uma consulta ao banco para responder ao
 * health check. `synchronize` fica desabilitado para impedir alterações
 * implícitas no schema existente.
 */
@Injectable()
export class TypeOrmDataSourceService implements OnModuleDestroy {
  private readonly dataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL ?? defaultDatabaseUrl,
    entities: [DashboardPreferenceEntity],
    synchronize: false,
    logging: false,
    extra: {
      max: 10,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      statement_timeout: 15_000,
    },
  });

  private initialization?: Promise<DataSource>;

  async getDataSource(): Promise<DataSource> {
    if (this.dataSource.isInitialized) return this.dataSource;
    this.initialization ??= this.dataSource.initialize();
    return this.initialization;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.dataSource.isInitialized) await this.dataSource.destroy();
  }
}
