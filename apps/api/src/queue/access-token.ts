import { createHmac } from "node:crypto";
import { safeEqual } from "../common/http.js";

// Token cho vào: ký HMAC, không lưu ở đâu → bước giữ ghế chỉ kiểm chữ ký, không gọi Redis (ADR 0002).
type Claims = { e: string; c: string; exp: number };

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function issueAccessToken(eventId: string, clientId: string, expiresAt: Date, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ e: eventId, c: clientId, exp: expiresAt.getTime() } satisfies Claims)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyAccessToken(token: string, secret: string, now = Date.now()): { eventId: string; clientId: string } | null {
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined || !safeEqual(sig, sign(payload, secret))) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as Claims;
    return claims.exp > now ? { eventId: claims.e, clientId: claims.c } : null;
  } catch {
    return null;
  }
}
