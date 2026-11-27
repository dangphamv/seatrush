import { bootApp } from "../testing/app.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signedFakeWebhook } from "../payments/payments.service.js";
import { GROUP, OutboxService, STREAM } from "./outbox.service.js";

describe("outbox", () => {
  let t: Awaited<ReturnType<typeof bootApp>>;
  let outbox: OutboxService;
  beforeAll(async () => {
    t = await bootApp();
    outbox = t.app.get(OutboxService);
    // Bắt đầu từ trạng thái sạch: event cũ của các file test khác đã được đẩy và tiêu thụ.
    while ((await outbox.relay()) > 0);
    while ((await outbox.consume()) > 0);
  });
  afterAll(() => t.app.close());

  it("NTF-01 relays a confirmed order to the stream and notifies once", async () => {
    const ev = await t.event();
    const b = await t.buyer(ev.id);
    const order = (await t.hold(b, { sectionId: ev.sectionId, quantity: 1 }).expect(201)).body;
    await t.http().post("/v1/payments/webhook").send(signedFakeWebhook(order.code, order.amountVnd, `N-${order.code}`)).expect(200);

    expect(await outbox.relay()).toBe(1);
    expect(await outbox.relay()).toBe(0);
    const [ob] = await t.sql`select id::int as id, published_at from outbox where aggregate_id = ${order.id}`;
    expect(ob.published_at).not.toBeNull();

    expect(await outbox.consume()).toBe(1);
    const [n] = await t.sql`select channel, payload from notifications where order_id = ${order.id}`;
    expect(n.channel).toBe("email");
    expect(n.payload).toMatchObject({ topic: "order.confirmed", code: order.code });
    const pending = (await t.redis.xpending(STREAM, GROUP)) as [number];
    expect(pending[0]).toBe(0);

    // At-least-once: cùng event giao lại (relay chạy lại sau khi commit lỗi) → vẫn chỉ 1 thông báo.
    expect(await outbox.deliver({ outboxId: ob.id, topic: "order.confirmed", orderId: order.id, payload: {} })).toBe(false);
    const [{ c }] = await t.sql`select count(*)::int as c from notifications where order_id = ${order.id}`;
    expect(c).toBe(1);
  });

  it("NTF-01 parallel relays never publish the same row twice", async () => {
    const ev = await t.event({ sections: [{ name: "A", priceVnd: 100_000, rows: 1, seatsPerRow: 20 }] });
    for (let i = 0; i < 20; i++) {
      const b = await t.buyer(ev.id);
      const o = (await t.hold(b, { sectionId: ev.sectionId, quantity: 1 }).expect(201)).body;
      await t.http().post("/v1/payments/webhook").send(signedFakeWebhook(o.code, o.amountVnd, `P-${o.code}`)).expect(200);
    }
    const counts = await Promise.all([outbox.relay(5), outbox.relay(5), outbox.relay(5), outbox.relay(5)]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(20);
  });
});
