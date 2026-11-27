import { ADMIN, bootApp } from "../testing/app.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("events", () => {
  let t: Awaited<ReturnType<typeof bootApp>>;
  beforeAll(async () => (t = await bootApp()));
  afterAll(() => t.app.close());

  it("EVT-01 lists on-sale events only, ordered by sales open time", async () => {
    const late = await t.event({ openAt: new Date(Date.now() + 7200_000) });
    const early = await t.event({ openAt: new Date(Date.now() - 7200_000) });
    const draft = await t.event({ status: "draft" });
    const ids = ((await t.http().get("/v1/events").expect(200)).body as { id: string }[]).map((e) => e.id);
    expect(ids).toContain(late.id);
    expect(ids.indexOf(early.id)).toBeLessThan(ids.indexOf(late.id));
    expect(ids).not.toContain(draft.id);
  });

  it("EVT-02 counts expired holds as available", async () => {
    const ev = await t.event();
    const b = await t.buyer(ev.id);
    const order = (await t.hold(b, { sectionId: ev.sectionId, quantity: 2 }).expect(201)).body as { id: string };
    let sec = (await t.http().get(`/v1/events/${ev.id}`).expect(200)).body.sections[0];
    expect(sec).toMatchObject({ total: 10, available: 8, priceVnd: 500_000 });
    await t.sql`update seats set held_until = now() - interval '1 second' where order_id = ${order.id}`;
    sec = (await t.http().get(`/v1/events/${ev.id}`).expect(200)).body.sections[0];
    expect(sec.available).toBe(10);
  });

  it("EVT-02 returns problem+json 404 for unknown events", async () => {
    const res = await t.http().get("/v1/events/00000000-0000-4000-8000-000000000000").expect(404);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.body).toMatchObject({ type: "event_not_found", status: 404 });
  });

  it("EVT-03 admin creates an event and its seats; others get 401", async () => {
    const body = {
      slug: `adm-${Date.now()}`,
      name: "Admin tạo",
      venue: "Nhà hát",
      startsAt: new Date(Date.now() + 86400_000).toISOString(),
      salesOpenAt: new Date().toISOString(),
      sections: [
        { name: "VIP", priceVnd: 2_000_000, rows: 3, seatsPerRow: 4 },
        { name: "GA", priceVnd: 800_000, rows: 30, seatsPerRow: 10 },
      ],
    };
    await t.http().post("/v1/admin/events").send(body).expect(401);
    await t.http().post("/v1/admin/events").set("authorization", "Bearer wrong-token-xx").send(body).expect(401);
    const res = await t.http().post("/v1/admin/events").set("authorization", `Bearer ${ADMIN}`).send(body).expect(201);
    expect(res.body.sections.map((s: { total: number }) => s.total)).toEqual([12, 300]);
    const [{ ab }] = await t.sql`select row_label as ab from seats where section_id = ${res.body.sections[1].id} and row_no = 27 limit 1`;
    expect(ab).toBe("AA");
    await t.http().post("/v1/admin/events").set("authorization", `Bearer ${ADMIN}`).send(body).expect(409);
    await t.http().post("/v1/admin/events").set("authorization", `Bearer ${ADMIN}`).send({ ...body, sections: [] }).expect(422);
  });
});
