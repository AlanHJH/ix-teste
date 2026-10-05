import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool, QueryResultRow, types } from "pg";

types.setTypeParser(20, Number);
types.setTypeParser(1700, Number);

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://ondaluz:ondaluz@localhost:5432/ondaluz",
    max: 10,
  });

  query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
    return this.pool.query<T>(text, params);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
