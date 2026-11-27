import { bootApp } from "../testing/app.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OrdersService } from "../orders/orders.service.js";
import { signedFakeWebhook } from "./payments.service.js";

describe("payments", () => {
  let t: Awaited<ReturnType<typeof bootApp>>;
  beforeAll(async () => (t = await bootApp()));
  afterAll(() => t.app.close());

  async function pendingOrder(quantity = 2, seatsPerRow = 5) {
    const ev = await t.event({ sections: [{ name: "A", priceVnd: 700_000, rows: 1, seatsPerRow }] });
    const b = await t.buyer(ev.id);
    const order = (await t.hold(b, { sectionId: ev.sectionId, quantity }).expect(201)).body as { id: string; code: number; amountVnd: number };
    return { ev, b, order };
  }
  const webhook = (body: object) => t.http().post("/v1/payments/webhook").send(body);

  it("PAY-01 gives a checkout link only for payable orders", async () => {
    const { b, order } = await pendingOrder();
    const res = await t.http().post(`/v1/orders/${order.id}/checkout`).set("x-client-id", b.clientId).expect(200);
    expect(res.body.checkoutUrl).toContain(`/pay/fake/${order.code}`);
    await webhook(signedFakeWebhook(order.code, order.amountVnd, `R-${order.code}`)).expect(200);
    expect((await t.http().post(`/v1/orders/${order.id}/checkout`).set("x-client-id", b.clientId).expect(409)).body.type).toBe("order_not_payable");
  });

  it("PAY-02 confirms the order, issues one ticket per seat, emits order.confirmed", async () => {
    const { b, order } = await pendingOrder();
    const res = await webhook(signedFakeWebhook(order.code, order.amountVnd, `R-${order.code}`)).expect(200);
    expect(res.body.outcome).toBe("confirmed");
    const o = (await t.http().get(`/v1/orders/${order.id}`).set("x-client-id", b.clientId).expect(200)).body;
    expect(o).toMatchObject({ status: "confirmed", seats: ["A-01", "A-02"] });
    expect(o.tickets).toHaveLength(2);
    const seats = await t.sql`select status from seats where order_id = ${order.id}`;
    expect(seats.every((s) => s.status === "sold")).toBe(true);
    const [ob] = await t.sql`select topic, payload from outbox where aggregate_id = ${order.id}`;
    expect(ob.topic).toBe("order.confirmed");
  });

  it("PAY-02 rejects bad signatures without changing anything", async () => {
    const { order } = await pendingOrder();
    const body = signedFakeWebhook(order.code, order.amountVnd, `R-${order.code}`);
    await webhook({ ...body, signature: "00".repeat(32) }).expect(401);
    await webhook({ ...body, data: { ...body.data, amount: 1 } }).expect(401);
    const [o] = await t.sql`select status from orders where id = ${order.id}`;
    expect(o.status).toBe("pending");
  });

  it("PAY-02 flags a wrong amount for refund and releases the seats", async () => {
    const { order } = await pendingOrder();
    expect((await webhook(signedFakeWebhook(order.code, 1000, `R-${order.code}`)).expect(200)).body.outcome).toBe("refund_required");
    const [o] = await t.sql`select status from orders where id = ${order.id}`;
    expect(o.status).toBe("refund_required");
    const [{ n }] = await t.sql`select count(*)::int as n from seats where order_id = ${order.id}`;
    expect(n).toBe(0);
  });

  it("PAY-03 processes a webhook delivered many times concurrently exactly once", async () => {
    const { order } = await pendingOrder();
    const body = signedFakeWebhook(order.code, order.amountVnd, `R-${order.code}`);
    const results = await Promise.all(Array.from({ length: 10 }, () => webhook(body)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.map((r) => r.body.outcome).sort()).toEqual(["confirmed", ...Array(9).fill("duplicate")]);
    const [{ n }] = await t.sql`select count(*)::int as n from tickets where order_id = ${order.id}`;
    expect(n).toBe(2);
    const [{ events }] = await t.sql`select count(*)::int as events from payment_events where order_id = ${order.id}`;
    expect(events).toBe(1);
  });

  it("PAY-03 flags money arriving after expiry for refund, without tickets", async () => {
    const { order } = await pendingOrder();
    await t.sql`update orders set expires_at = now() - interval '1 second' where id = ${order.id}`;
    await t.app.get(OrdersService).expireDue();
    expect((await webhook(signedFakeWebhook(order.code, order.amountVnd, `R-${order.code}`)).expect(200)).body.outcome).toBe("refund_required");
    const [o] = await t.sql`select status from orders where id = ${order.id}`;
    expect(o.status).toBe("refund_required");
    const [{ n }] = await t.sql`select count(*)::int as n from tickets where order_id = ${order.id}`;
    expect(n).toBe(0);
    const topics = (await t.sql`select topic from outbox where aggregate_id = ${order.id} order by id`).map((r) => r.topic);
    expect(topics).toEqual(["order.expired", "order.refund_required"]);
  });

  it("PAY-03 refunds when the hold lapsed and someone else took the seats", async () => {
    const { ev, order } = await pendingOrder(2, 2);
    await t.sql`update seats set held_until = now() - interval '1 second' where order_id = ${order.id}`;
    const other = await t.buyer(ev.id);
    await t.hold(other, { sectionId: ev.sectionId, quantity: 2 }).expect(201);
    expect((await webhook(signedFakeWebhook(order.code, order.amountVnd, `R-${order.code}`)).expect(200)).body.outcome).toBe("refund_required");
    const [{ sold }] = await t.sql`select count(*)::int as sold from seats where section_id = ${ev.sectionId} and status = 'sold'`;
    expect(sold).toBe(0);
  });

  it("fake gateway pays an order end to end", async () => {
    const { order } = await pendingOrder();
    expect((await t.http().post(`/v1/payments/fake/${order.code}/pay`).expect(200)).body.outcome).toBe("confirmed");
  });
});
