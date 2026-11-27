import { randomBytes } from "node:crypto";
import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { ApiError } from "../common/errors.js";
import { SQL, type Sql } from "../common/infra.module.js";
import { track } from "../common/metrics.js";
import { env, isProduction } from "../env.js";
import { createPaymentLink, verifyWebhook, webhookSignature } from "./payos.js";

export const FAKE_CHECKSUM_KEY = "seatrush-fake-checksum-key";

type Provider = { kind: "payos"; clientId: string; apiKey: string; checksumKey: string } | { kind: "fake"; checksumKey: string };

export function provider(): Provider | null {
  const { PAYOS_CLIENT_ID: clientId, PAYOS_API_KEY: apiKey, PAYOS_CHECKSUM_KEY: checksumKey } = env;
  if (clientId && apiKey && checksumKey) return { kind: "payos", clientId, apiKey, checksumKey };
  return isProduction ? null : { kind: "fake", checksumKey: FAKE_CHECKSUM_KEY };
}

export type WebhookBody = { code?: string; success?: boolean; data?: Record<string, unknown>; signature?: string };
export type WebhookOutcome = "confirmed" | "duplicate" | "refund_required" | "ignored" | "unknown_order";

const ticketCode = () => randomBytes(6).toString("base64url").toUpperCase().replace(/[-_]/g, "X");

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger("Payments");

  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async checkout(orderId: string, clientId: string): Promise<{ checkoutUrl: string }> {
    const p = provider();
    if (!p) throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "payments_disabled");
    const [o] = await this.sql<{ code: number; amount: number; email: string; expiresAt: Date }[]>`
      select code::int as code, amount_vnd::int as amount, email, expires_at as "expiresAt" from orders
      where id = ${orderId} and client_id = ${clientId} and status = 'pending' and expires_at > now()`;
    if (!o) throw new ApiError(HttpStatus.CONFLICT, "order_not_payable", "Đơn đã hết hạn, đã thanh toán, hoặc không tồn tại");
    track("checkout_started");
    const back = `${env.WEB_URL}/orders/${orderId}`;
    if (p.kind === "fake") return { checkoutUrl: `${env.WEB_URL}/pay/fake/${o.code}?order=${orderId}` };
    const checkoutUrl = await createPaymentLink(p, {
      orderCode: o.code,
      amount: o.amount,
      // Ngân hàng không liên kết PayOS chỉ nhận 9 ký tự nội dung chuyển khoản.
      description: `SR${o.code}`.slice(0, 9),
      returnUrl: back,
      cancelUrl: back,
      buyerEmail: o.email,
      expiredAt: o.expiresAt,
    });
    return { checkoutUrl };
  }

  // PAY-02, PAY-03. Mọi nhánh đều trong 1 transaction: ghi nhận webhook, đổi trạng thái đơn/ghế, cấp vé, ghi outbox.
  async handleWebhook(body: WebhookBody): Promise<WebhookOutcome> {
    const p = provider();
    if (!p || !body.data || !verifyWebhook(body.data, body.signature, p.checksumKey)) throw new ApiError(HttpStatus.UNAUTHORIZED, "bad_signature");
    const data = body.data;
    const orderCode = Number(data.orderCode);
    const amount = Number(data.amount);
    const reference = String(data.reference ?? "");
    if (body.code !== "00" || data.code !== "00" || !reference || !Number.isFinite(orderCode)) return "ignored";

    return this.sql.begin(async (tx): Promise<WebhookOutcome> => {
      // Webhook trùng (kể cả đồng thời): insert thứ 2 chờ insert thứ nhất commit rồi không ghi gì → bỏ qua.
      const [pe] = await tx<{ id: number }[]>`
        insert into payment_events (provider, provider_ref, amount_vnd, outcome, payload)
        values (${p.kind}, ${reference}, ${amount}, 'received', ${tx.json(stripPayer(data) as never)})
        on conflict (provider, provider_ref) do nothing returning id`;
      if (!pe) return "duplicate";

      const [order] = await tx<{ id: string; status: string; quantity: number; amount: number; email: string; code: number }[]>`
        select id, status, quantity, amount_vnd::int as amount, email, code::int as code from orders where code = ${orderCode} for update`;
      const outcome = (o: WebhookOutcome) => tx`update payment_events set outcome = ${o}, order_id = ${order?.id ?? null} where id = ${pe.id}`.then(() => o);
      if (!order) return outcome("unknown_order");

      const refund = async (reason: string) => {
        await tx`update orders set status = 'refund_required' where id = ${order.id} and status <> 'confirmed'`;
        await tx`update seats set status = 'available', order_id = null, held_until = null where order_id = ${order.id} and status = 'held'`;
        await tx`insert into outbox (topic, aggregate_id, payload)
                 values ('order.refund_required', ${order.id}, ${tx.json({ orderId: order.id, code: order.code, email: order.email, amount, reason })})`;
        track("payment_late", reason);
        this.logger.warn(`order ${order.code} needs refund: ${reason}`);
        return outcome("refund_required");
      };

      if (order.status === "confirmed") return refund("already_paid");
      if (order.status !== "pending") return refund(`order_${order.status}`);
      if (amount !== order.amount) return refund("amount_mismatch");

      // Ghế phải còn thuộc đơn này. Giữ đã hết hạn và người khác lấy mất → số dòng thiếu → hoàn tiền (ADR 0001).
      const sold = await tx<{ id: number }[]>`
        update seats set status = 'sold', held_until = null where order_id = ${order.id} and status = 'held' returning id`;
      if (sold.length !== order.quantity) return refund("seats_lost");

      const tickets = sold.map((s) => ({ order_id: order.id, seat_id: s.id, code: ticketCode() }));
      await tx`insert into tickets ${tx(tickets)}`;
      await tx`update orders set status = 'confirmed', confirmed_at = now() where id = ${order.id}`;
      await tx`insert into outbox (topic, aggregate_id, payload)
               values ('order.confirmed', ${order.id}, ${tx.json({ orderId: order.id, code: order.code, email: order.email, tickets: tickets.map((t) => t.code) })})`;
      track("order_confirmed");
      return outcome("confirmed");
    });
  }

  // Cổng giả lập (dev, load test): tạo webhook có chữ ký như PayOS rồi xử lý như webhook thật.
  async fakePay(orderCode: number): Promise<WebhookOutcome> {
    const p = provider();
    if (p?.kind !== "fake") throw new ApiError(HttpStatus.NOT_FOUND, "not_found");
    const [o] = await this.sql<{ amount: number }[]>`select amount_vnd::int as amount from orders where code = ${orderCode}`;
    if (!o) throw new ApiError(HttpStatus.NOT_FOUND, "order_not_found");
    return this.handleWebhook(signedFakeWebhook(orderCode, o.amount, `FAKE${orderCode}-${randomBytes(4).toString("hex")}`));
  }
}

export function signedFakeWebhook(orderCode: number, amount: number, reference: string): WebhookBody {
  const data = { orderCode, amount, reference, code: "00", desc: "success", description: `SR${orderCode}`, transactionDateTime: new Date().toISOString() };
  return { code: "00", success: true, data, signature: webhookSignature(data, FAKE_CHECKSUM_KEY) };
}

// Webhook PayOS kèm tên + số tài khoản người trả — không cần, không lưu (tối thiểu hoá dữ liệu, PRD Compliance).
const stripPayer = (d: Record<string, unknown>) => Object.fromEntries(Object.entries(d).filter(([k]) => !/^counterAccount/.test(k)));
