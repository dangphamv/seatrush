import { bootApp } from "../testing/app.js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { issueAccessToken, verifyAccessToken } from "./access-token.js";

describe("queue", () => {
  let t: Awaited<ReturnType<typeof bootApp>>;
  beforeAll(async () => (t = await bootApp()));
  afterAll(() => t.app.close());

  it("QUE-01 rejects joining before sales open", async () => {
    const ev = await t.event({ openAt: new Date(Date.now() + 60_000) });
    const res = await t.http().post(`/v1/events/${ev.id}/queue`).set("x-client-id", randomUUID()).expect(409);
    expect(res.body.type).toBe("sales_not_open");
  });

  it("QUE-01 joining twice keeps the same place", async () => {
    const ev = await t.event({ openAt: new Date() });
    const ids = Array.from({ length: 30 }, () => randomUUID());
    for (const id of ids) await t.http().post(`/v1/events/${ev.id}/queue`).set("x-client-id", id).expect(200);
    const again = await Promise.all(ids.map((id) => t.http().post(`/v1/events/${ev.id}/queue`).set("x-client-id", id)));
    expect(await t.redis.zcard(`queue:${ev.id}`)).toBe(30);
    expect(await t.redis.zrank(`queue:${ev.id}`, ids[29])).toBe(29);
    expect(again.every((r) => r.status === 200)).toBe(true);
  });

  it("QUE-02 admits the head of the line and tells the rest their position", async () => {
    const ev = await t.event({ openAt: new Date() });
    const ids = Array.from({ length: 40 }, () => randomUUID());
    for (const id of ids) await t.http().post(`/v1/events/${ev.id}/queue`).set("x-client-id", id).expect(200);
    const first = (await t.http().get(`/v1/events/${ev.id}/queue`).set("x-client-id", ids[0]).expect(200)).body;
    const last = (await t.http().get(`/v1/events/${ev.id}/queue`).set("x-client-id", ids[39]).expect(200)).body;
    // Tốc độ thử = 10 người/giây; 40 lượt vào xong trong < 3 giây → người cuối chưa tới lượt.
    expect(last.admitted).toBe(false);
    expect(last.position).toBeGreaterThan(0);
    expect(last.etaSeconds).toBeGreaterThan(0);
    expect(last.accessToken).toBeUndefined();
    await new Promise((r) => setTimeout(r, 150));
    expect((await t.http().get(`/v1/events/${ev.id}/queue`).set("x-client-id", ids[0])).body.admitted).toBe(true);
    expect(first.position).toBe(0);
    await t.http().get(`/v1/events/${ev.id}/queue`).set("x-client-id", randomUUID()).expect(404);
  });

  it("QUE-03 access tokens are bound to client, event, and expiry", async () => {
    const secret = "s".repeat(32);
    const tok = issueAccessToken("e1", "c1", new Date(Date.now() + 1000), secret);
    expect(verifyAccessToken(tok, secret)).toEqual({ eventId: "e1", clientId: "c1" });
    expect(verifyAccessToken(tok, "x".repeat(32))).toBeNull();
    expect(verifyAccessToken(tok, secret, Date.now() + 2000)).toBeNull();
    expect(verifyAccessToken(tok.replace(/^./, "A"), secret)).toBeNull();

    const ev = await t.event();
    const other = await t.event();
    const b = await t.buyer(ev.id);
    await t.hold({ clientId: b.clientId, token: "garbage" }, { sectionId: ev.sectionId, quantity: 1 }).expect(403);
    await t.hold({ clientId: randomUUID(), token: b.token }, { sectionId: ev.sectionId, quantity: 1 }).expect(403);
    await t.hold(b, { sectionId: other.sectionId, quantity: 1 }).expect(403);
    await t.hold(b, { sectionId: ev.sectionId, quantity: 1 }).expect(201);
  });
});
