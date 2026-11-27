import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Redis } from "ioredis";
import { REDIS, SQL, type Sql } from "../common/infra.module.js";

export const STREAM = "seatrush.orders";
export const GROUP = "notifier";

type Msg = { outboxId: number; topic: string; orderId: string; payload: Record<string, unknown> };

// ADR 0003: outbox → Redis Streams (at-least-once) → notifier idempotent.
@Injectable()
export class OutboxService {
  private readonly logger = new Logger("Outbox");
  private readonly consumer = `api-${process.pid}`;
  private groupReady = false;

  constructor(
    @Inject(SQL) private readonly sql: Sql,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  // XADD trước, đánh dấu published sau, cùng transaction đang khoá dòng: commit lỗi thì lần sau đẩy lại (trùng, không mất).
  async relay(limit = 100): Promise<number> {
    return this.sql.begin(async (tx) => {
      const rows = await tx<{ id: number; topic: string; aggregateId: string; payload: unknown }[]>`
        select id::int as id, topic, aggregate_id as "aggregateId", payload from outbox
        where published_at is null order by id limit ${limit} for update skip locked`;
      if (!rows.length) return 0;
      const pipe = this.redis.pipeline();
      for (const r of rows) pipe.xadd(STREAM, "*", "id", String(r.id), "topic", r.topic, "order", r.aggregateId, "payload", JSON.stringify(r.payload));
      const res = await pipe.exec();
      const failed = res?.find(([err]) => err);
      if (failed) throw failed[0];
      await tx`update outbox set published_at = now() where id = any(${rows.map((r) => r.id)}::bigint[])`;
      return rows.length;
    });
  }

  private async ensureGroup() {
    if (this.groupReady) return;
    try {
      await this.redis.xgroup("CREATE", STREAM, GROUP, "0", "MKSTREAM");
    } catch (err) {
      if (!String(err).includes("BUSYGROUP")) throw err;
    }
    this.groupReady = true;
  }

  // Nhận message mới + message của consumer khác bị treo quá 30 giây; ghi thông báo với event_id UNIQUE rồi mới ack.
  async consume(count = 100): Promise<number> {
    await this.ensureGroup();
    const [, claimed] = (await this.redis.xautoclaim(STREAM, GROUP, this.consumer, 30_000, "0-0", "COUNT", count)) as [string, [string, string[]][]];
    const fresh = (await this.redis.xreadgroup("GROUP", GROUP, this.consumer, "COUNT", count, "STREAMS", STREAM, ">")) as [string, [string, string[]][]][] | null;
    const entries = [...(claimed ?? []), ...(fresh?.[0]?.[1] ?? [])];
    for (const [streamId, fields] of entries) {
      await this.deliver(parse(fields));
      await this.redis.xack(STREAM, GROUP, streamId);
    }
    return entries.length;
  }

  // Gửi email thật nằm ngoài MVP: thông báo được lưu lại và log; nơi gửi thật (Resend, dự án Notify) đọc từ đây.
  async deliver(m: Msg): Promise<boolean> {
    const [row] = await this.sql`
      insert into notifications (event_id, order_id, channel, payload)
      values (${m.outboxId}, ${m.orderId}, 'email', ${this.sql.json({ topic: m.topic, ...m.payload } as never)})
      on conflict (event_id) do nothing returning id`;
    if (row) this.logger.log(`notify ${m.topic} order=${m.orderId}`);
    return Boolean(row);
  }
}

function parse(fields: string[]): Msg {
  const f: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) f[fields[i]] = fields[i + 1];
  return { outboxId: Number(f.id), topic: f.topic, orderId: f.order, payload: JSON.parse(f.payload) as Record<string, unknown> };
}
