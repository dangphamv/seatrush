import { Controller, Get, Header, Inject, VERSION_NEUTRAL } from "@nestjs/common";
import type { Redis } from "ioredis";
import { REDIS, SQL, type Sql } from "../common/infra.module.js";
import { registry } from "../common/metrics.js";

@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get("health")
  async health() {
    await Promise.all([this.sql`select 1`, this.redis.ping()]);
    return { status: "ok" };
  }

  @Get("metrics")
  @Header("Content-Type", registry.contentType)
  metrics() {
    return registry.metrics();
  }
}
