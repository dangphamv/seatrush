import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { ApiError } from "../common/errors.js";
import { REDIS, SQL, type Sql } from "../common/infra.module.js";
import { track } from "../common/metrics.js";
import { env } from "../env.js";
import { issueAccessToken } from "./access-token.js";

// Cấp số thứ tự và xếp hàng trong 1 lệnh: gọi lại không đổi vị trí (ZADD NX), không có khe giữa INCR và ZADD.
const JOIN = `
local s = redis.call('ZSCORE', KEYS[1], ARGV[1])
if s then return 0 end
local seq = redis.call('INCR', KEYS[2])
redis.call('ZADD', KEYS[1], seq, ARGV[1])
return 1`;

export type QueueStatus = { admitted: boolean; position: number; etaSeconds: number; accessToken?: string; accessExpiresAt?: Date };

@Injectable()
export class QueueService {
  // Giờ mở bán ít khi đổi: cache 5 giây để mỗi lần hỏi vị trí không chạm DB.
  private readonly opens = new Map<string, { at: number; status: string; until: number }>();

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  private key = (eventId: string) => `queue:${eventId}`;

  private async event(eventId: string) {
    const hit = this.opens.get(eventId);
    if (hit && hit.until > Date.now()) return hit;
    const [ev] = await this.sql<{ salesOpenAt: Date; status: string }[]>`
      select sales_open_at as "salesOpenAt", status from events where id = ${eventId} and status <> 'draft'`;
    if (!ev) throw new ApiError(HttpStatus.NOT_FOUND, "event_not_found");
    const v = { at: ev.salesOpenAt.getTime(), status: ev.status, until: Date.now() + 5000 };
    this.opens.set(eventId, v);
    return v;
  }

  // Vạch cho vào tính từ thời gian → không cần job nền, mọi instance cho cùng kết quả (ADR 0002).
  admittedCount(openAt: number, now = Date.now()): number {
    return Math.max(0, Math.floor(((now - openAt) / 1000) * env.SEATRUSH_ADMIT_RATE));
  }

  async join(eventId: string, clientId: string): Promise<QueueStatus> {
    const ev = await this.event(eventId);
    if (ev.status === "closed") throw new ApiError(HttpStatus.CONFLICT, "sales_closed");
    if (Date.now() < ev.at) throw new ApiError(HttpStatus.CONFLICT, "sales_not_open");
    const added = await this.redis.eval(JOIN, 2, this.key(eventId), `${this.key(eventId)}:seq`, clientId);
    if (added === 1) track("queue_joined");
    return this.status(eventId, clientId);
  }

  async status(eventId: string, clientId: string): Promise<QueueStatus> {
    const ev = await this.event(eventId);
    const rank = await this.redis.zrank(this.key(eventId), clientId);
    if (rank === null) throw new ApiError(HttpStatus.NOT_FOUND, "not_in_queue");
    const admitted = this.admittedCount(ev.at);
    if (rank < admitted) {
      const accessExpiresAt = new Date(Date.now() + env.SEATRUSH_ACCESS_MINUTES * 60_000);
      track("queue_admitted");
      return { admitted: true, position: 0, etaSeconds: 0, accessToken: issueAccessToken(eventId, clientId, accessExpiresAt, env.ACCESS_TOKEN_SECRET), accessExpiresAt };
    }
    const ahead = rank - admitted;
    return { admitted: false, position: ahead, etaSeconds: Math.ceil((ahead + 1) / env.SEATRUSH_ADMIT_RATE) };
  }

  async stats(eventId: string): Promise<{ queueLength: number; admitted: number }> {
    const ev = await this.event(eventId);
    const queueLength = await this.redis.zcard(this.key(eventId));
    return { queueLength, admitted: Math.min(queueLength, this.admittedCount(ev.at)) };
  }
}
