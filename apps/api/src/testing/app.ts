import { randomUUID } from "node:crypto";
import { Agent } from "node:http";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { createEvent, type NewSection } from "@seatrush/db";
import request from "supertest";

// Trước khi import app: tắt việc nền (test tự gọi), tắt rate limit, cho vào gần như ngay khi mở bán.
process.env.SEATRUSH_WORKERS = "0";
process.env.SEATRUSH_RATE_LIMIT = "0";
process.env.SEATRUSH_ADMIT_RATE = "10";
process.env.ADMIN_TOKEN ??= "test-admin-token";
process.env.ACCESS_TOKEN_SECRET ??= "test-access-token-secret";

export const ADMIN = process.env.ADMIN_TOKEN;

export async function bootApp() {
  const [{ AppModule }, { configureApp }, { SQL, REDIS }] = await Promise.all([
    import("../app.module.js"),
    import("../setup.js"),
    import("../common/infra.module.js"),
  ]);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>({ logger: ["error"] }));
  // Lắng nghe 1 cổng thật: supertest tự mở server mới cho mỗi request thì 200 request song song bị ECONNRESET.
  await app.listen(0, "127.0.0.1");
  const base = await app.getUrl();
  const sql = app.get<import("@seatrush/db").Sql>(SQL);
  const redis = app.get<import("ioredis").Redis>(REDIS);
  // macOS giới hạn backlog 128: dùng lại kết nối (tối đa 64). Pool DB chỉ 20 nên tranh chấp ở DB vẫn như cũ.
  const agent = new Agent({ keepAlive: true, maxSockets: 64 });
  const http = () => {
    const r = request(base);
    const wrap = <T extends request.Test>(t: T) => t.agent(agent) as T;
    return {
      get: (u: string) => wrap(r.get(u)),
      post: (u: string) => wrap(r.post(u)),
    };
  };

  // Mỗi test tạo sự kiện riêng → không phụ thuộc thứ tự, không cần dọn DB giữa các test.
  async function event(opts: { sections?: NewSection[]; openAt?: Date; status?: string } = {}) {
    const id = await createEvent(
      sql,
      {
        slug: `t-${randomUUID().slice(0, 12)}`,
        name: "Sự kiện thử",
        venue: "Sân thử",
        startsAt: new Date(Date.now() + 86400_000),
        salesOpenAt: opts.openAt ?? new Date(Date.now() - 3600_000),
        sections: opts.sections ?? [{ name: "A", priceVnd: 500_000, rows: 2, seatsPerRow: 5 }],
      },
      opts.status,
    );
    const sections = await sql<{ id: string; name: string }[]>`select id, name from sections where event_id = ${id} order by sort`;
    return { id, sectionId: sections[0].id, sections };
  }

  // Một người mua đã qua hàng chờ: có client id và access token.
  async function buyer(eventId: string) {
    const clientId = randomUUID();
    const res = await http().post(`/v1/events/${eventId}/queue`).set("x-client-id", clientId).expect(200);
    if (!res.body.admitted) throw new Error("buyer not admitted");
    return { clientId, token: res.body.accessToken as string };
  }

  function hold(b: { clientId: string; token: string }, body: { sectionId: string; quantity: number; email?: string }, key = randomUUID()) {
    return http()
      .post("/v1/orders")
      .set("x-client-id", b.clientId)
      .set("x-access-token", b.token)
      .set("idempotency-key", key)
      .send({ email: `${randomUUID().slice(0, 8)}@test.vn`, ...body });
  }

  return { app, base, sql, redis, http, event, buyer, hold };
}
