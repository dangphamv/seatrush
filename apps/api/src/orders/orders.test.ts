import { bootApp } from "../testing/app.js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OrdersService } from "./orders.service.js";

describe("orders", () => {
  let t: Awaited<ReturnType<typeof bootApp>>;
  beforeAll(async () => (t = await bootApp()));
  afterAll(() => t.app.close());

  it("HLD-01 holds adjacent seats in row order for 10 minutes", async () => {
    const ev = await t.event();
    const b = await t.buyer(ev.id);
    const res = await t.hold(b, { sectionId: ev.sectionId, quantity: 3, email: "Linh@Test.vn" }).expect(201);
    expect(res.body).toMatchObject({ status: "pending", quantity: 3, amountVnd: 1_500_000, seats: ["A-01", "A-02", "A-03"], email: "linh@test.vn" });
    const ms = new Date(res.body.expiresAt).getTime() - Date.now();
    expect(ms).toBeGreaterThan(9 * 60_000);
    expect(ms).toBeLessThanOrEqual(10 * 60_000);
  });

  it("HLD-01 is all-or-nothing and validates input", async () => {
    const ev = await t.event({ sections: [{ name: "A", priceVnd: 100_000, rows: 1, seatsPerRow: 3 }] });
    const b = await t.buyer(ev.id);
    await t.hold(b, { sectionId: ev.sectionId, quantity: 2 }).expect(201);
    const res = await t.hold(b, { sectionId: ev.sectionId, quantity: 2 }).expect(409);
    expect(res.body.type).toBe("not_enough_seats");
    const [{ free }] = await t.sql`select count(*)::int as free from seats where section_id = ${ev.sectionId} and status = 'available'`;
    expect(free).toBe(1);
    expect((await t.hold(b, { sectionId: ev.sectionId, quantity: 5 }).expect(422)).body.type).toBe("validation");
    await t.http().post("/v1/orders").set("x-client-id", b.clientId).set("x-access-token", b.token).send({ sectionId: ev.sectionId, quantity: 1, email: "a@b.vn" }).expect(400);
  });

  it("HLD-01 limits tickets per email per event, even with parallel orders", async () => {
    const ev = await t.event({ sections: [{ name: "A", priceVnd: 100_000, rows: 4, seatsPerRow: 10 }] });
    const b = await t.buyer(ev.id);
    const results = await Promise.all(Array.from({ length: 4 }, () => t.hold(b, { sectionId: ev.sectionId, quantity: 2, email: "same@test.vn" })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect(results.filter((r) => r.status === 422).every((r) => r.body.type === "ticket_limit")).toBe(true);
  });

  it("HLD-02 never gives one seat to two orders under contention", async () => {
    const ev = await t.event({ sections: [{ name: "A", priceVnd: 100_000, rows: 5, seatsPerRow: 10 }] });
    const buyers = await Promise.all(Array.from({ length: 200 }, () => t.buyer(ev.id)));
    const results = await Promise.all(buyers.map((b) => t.hold(b, { sectionId: ev.sectionId, quantity: 1 })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(50);
    expect(results.filter((r) => r.status === 409)).toHaveLength(150);
    const [{ held, orders }] = await t.sql`
      select count(*) filter (where status = 'held')::int as held, count(distinct order_id)::int as orders from seats where section_id = ${ev.sectionId}`;
    expect(held).toBe(50);
    expect(orders).toBe(50);
    const [{ pending }] = await t.sql`select count(*)::int as pending from orders where section_id = ${ev.sectionId}`;
    expect(pending).toBe(50);
  });

  it("HLD-03 replays the same order for a repeated Idempotency-Key, also in parallel", async () => {
    const ev = await t.event();
    const b = await t.buyer(ev.id);
    const key = randomUUID();
    const [a, c] = await Promise.all([t.hold(b, { sectionId: ev.sectionId, quantity: 2 }, key), t.hold(b, { sectionId: ev.sectionId, quantity: 2 }, key)]);
    expect([a.status, c.status].sort()).toEqual([200, 201]);
    expect(a.body.id).toBe(c.body.id);
    const again = await t.hold(b, { sectionId: ev.sectionId, quantity: 2 }, key).expect(200);
    expect(again.body.id).toBe(a.body.id);
    const [{ held }] = await t.sql`select count(*)::int as held from seats where section_id = ${ev.sectionId} and status = 'held'`;
    expect(held).toBe(2);
  });

  it("HLD-04 expires due orders, frees their seats, and emits order.expired", async () => {
    const ev = await t.event({ sections: [{ name: "A", priceVnd: 100_000, rows: 1, seatsPerRow: 2 }] });
    const b = await t.buyer(ev.id);
    const order = (await t.hold(b, { sectionId: ev.sectionId, quantity: 2 }).expect(201)).body;
    await t.hold(b, { sectionId: ev.sectionId, quantity: 1 }).expect(409);

    // Hết hạn nhưng job chưa chạy: người khác vẫn giữ được ghế đó.
    await t.sql`update orders set expires_at = now() - interval '1 second' where id = ${order.id}`;
    await t.sql`update seats set held_until = now() - interval '1 second' where order_id = ${order.id}`;
    const other = await t.buyer(ev.id);
    const taken = (await t.hold(other, { sectionId: ev.sectionId, quantity: 1 }).expect(201)).body;

    expect(await t.app.get(OrdersService).expireDue()).toBeGreaterThanOrEqual(1);
    const [o] = await t.sql`select status from orders where id = ${order.id}`;
    expect(o.status).toBe("expired");
    // Ghế đã sang đơn mới không bị trả lại.
    const seats = await t.sql`select status, order_id from seats where section_id = ${ev.sectionId} order by seat_no`;
    expect(seats.map((s) => [s.status, s.order_id])).toEqual([["held", taken.id], ["available", null]]);
    const [ob] = await t.sql`select topic from outbox where aggregate_id = ${order.id}`;
    expect(ob.topic).toBe("order.expired");
    expect((await t.http().get(`/v1/orders/${order.id}`).set("x-client-id", b.clientId).expect(200)).body).toMatchObject({ status: "expired", seats: [] });
    await t.http().get(`/v1/orders/${order.id}`).set("x-client-id", other.clientId).expect(404);
  });
});
