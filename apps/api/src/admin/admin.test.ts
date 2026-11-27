import { ADMIN, bootApp } from "../testing/app.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signedFakeWebhook } from "../payments/payments.service.js";

describe("admin stats", () => {
  let t: Awaited<ReturnType<typeof bootApp>>;
  beforeAll(async () => (t = await bootApp()));
  afterAll(() => t.app.close());

  it("ADM-01 reports seats, revenue and queue", async () => {
    const ev = await t.event();
    const a = await t.buyer(ev.id);
    const b = await t.buyer(ev.id);
    const paid = (await t.hold(a, { sectionId: ev.sectionId, quantity: 2 }).expect(201)).body;
    await t.hold(b, { sectionId: ev.sectionId, quantity: 3 }).expect(201);
    await t.http().post("/v1/payments/webhook").send(signedFakeWebhook(paid.code, paid.amountVnd, `A-${paid.code}`)).expect(200);

    await t.http().get(`/v1/admin/events/${ev.id}/stats`).expect(401);
    const res = await t.http().get(`/v1/admin/events/${ev.id}/stats`).set("authorization", `Bearer ${ADMIN}`).expect(200);
    expect(res.body).toEqual({ available: 5, held: 3, sold: 2, revenueVnd: 1_000_000, queueLength: 2, admitted: 2 });
  });

  it("ADM-01 streams stats over SSE", async () => {
    const ev = await t.event();
    const ctrl = new AbortController();
    const res = await fetch(`${t.base}/v1/admin/events/${ev.id}/stats/stream?token=${ADMIN}`, { signal: ctrl.signal });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    let text = "";
    while (!text.includes("\n\n")) text += new TextDecoder().decode((await reader.read()).value);
    ctrl.abort();
    const line = text.split("\n").find((l) => l.startsWith("data:"))!;
    expect(JSON.parse(line.slice(5))).toMatchObject({ available: 10, sold: 0 });
  });

  it("health and metrics are unversioned", async () => {
    expect((await t.http().get("/health").expect(200)).body).toEqual({ status: "ok" });
    expect((await t.http().get("/metrics").expect(200)).text).toContain("seatrush_events_total");
  });
});
