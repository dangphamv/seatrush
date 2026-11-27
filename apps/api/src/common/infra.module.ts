import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { createSql, type Sql } from "@seatrush/db";
import { Redis } from "ioredis";
import { env } from "../env.js";

export const SQL = Symbol("SQL");
export const REDIS = Symbol("REDIS");
export type { Sql };

// Một pool Postgres và một kết nối Redis cho cả process; đóng khi app tắt.
@Global()
@Module({
  providers: [
    { provide: SQL, useFactory: () => createSql(env.DATABASE_URL, env.DB_POOL_MAX) },
    { provide: REDIS, useFactory: () => new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 }) },
  ],
  exports: [SQL, REDIS],
})
export class InfraModule implements OnApplicationShutdown {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async onApplicationShutdown() {
    await this.sql.end({ timeout: 5 });
    this.redis.disconnect();
  }
}
