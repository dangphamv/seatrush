import { createHmac, timingSafeEqual } from "node:crypto";

// PayOS (VietQR). Tài liệu: https://payos.vn/docs/api/ — cùng cách ký với Kịp.
const API = "https://api-merchant.payos.vn";

const hmac = (key: string, data: string) => createHmac("sha256", key).update(data).digest("hex");

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

// Chữ ký tạo link: 5 trường cố định, sắp theo alphabet.
export function paymentRequestSignature(
  p: { amount: number; cancelUrl: string; description: string; orderCode: number; returnUrl: string },
  checksumKey: string,
): string {
  return hmac(checksumKey, `amount=${p.amount}&cancelUrl=${p.cancelUrl}&description=${p.description}&orderCode=${p.orderCode}&returnUrl=${p.returnUrl}`);
}

// Chữ ký webhook: chỉ ký object `data` — key sắp alphabet, null/undefined → "".
export function webhookSignature(data: Record<string, unknown>, checksumKey: string): string {
  const query = Object.keys(data)
    .sort()
    .filter((k) => data[k] !== undefined)
    .map((k) => {
      const v = data[k];
      const empty = v === null || v === "null" || v === "undefined";
      return `${k}=${empty ? "" : Array.isArray(v) ? JSON.stringify(v) : String(v)}`;
    })
    .join("&");
  return hmac(checksumKey, query);
}

export function verifyWebhook(data: Record<string, unknown>, signature: unknown, checksumKey: string): boolean {
  return typeof signature === "string" && safeEqualHex(webhookSignature(data, checksumKey), signature);
}

export async function createPaymentLink(
  cfg: { clientId: string; apiKey: string; checksumKey: string },
  p: { orderCode: number; amount: number; description: string; returnUrl: string; cancelUrl: string; buyerEmail: string; expiredAt: Date },
): Promise<string> {
  const req = { orderCode: p.orderCode, amount: p.amount, description: p.description, returnUrl: p.returnUrl, cancelUrl: p.cancelUrl };
  const res = await fetch(`${API}/v2/payment-requests`, {
    method: "POST",
    headers: { "x-client-id": cfg.clientId, "x-api-key": cfg.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ ...req, buyerEmail: p.buyerEmail, expiredAt: Math.floor(p.expiredAt.getTime() / 1000), signature: paymentRequestSignature(req, cfg.checksumKey) }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as { code?: string; desc?: string; data?: { checkoutUrl: string } } | null;
  if (!res.ok || json?.code !== "00" || !json.data) throw new Error(`payos: ${res.status} ${json?.code ?? ""} ${json?.desc ?? ""}`);
  return json.data.checkoutUrl;
}
