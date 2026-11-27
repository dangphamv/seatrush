import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ApiError } from "../common/errors.js";
import { SQL, type Sql } from "../common/infra.module.js";
import { track } from "../common/metrics.js";
import { env } from "../env.js";
import { verifyAccessToken } from "../queue/access-token.js";

export type HoldInput = { sectionId: string; quantity: number; email: string };

export type OrderDto = {
  id: string;
  code: number;
  eventId: string;
  sectionId: string;
  email: string;
  quantity: number;
  amountVnd: number;
  status: "pending" | "confirmed" | "expired" | "refund_required";
  expiresAt: Date;
  seats: string[];
  tickets: string[];
};

type OrderRow = Omit<OrderDto, "seats" | "tickets">;

const ORDER_COLUMNS = `id, code::int as code, event_id as "eventId", section_id as "sectionId", email, quantity,
  amount_vnd::int as "amountVnd", status, expires_at as "expiresAt"`;

@Injectable()
export class OrdersService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  // Trả về [đơn, có phải đơn mới]. Đơn cũ (trùng Idempotency-Key) → controller trả 200 thay vì 201.
  async hold(clientId: string, idempotencyKey: string, input: HoldInput, accessToken: string | undefined): Promise<[OrderDto, boolean]> {
    const access = accessToken ? verifyAccessToken(accessToken, env.ACCESS_TOKEN_SECRET) : null;
    if (!access || access.clientId !== clientId) throw new ApiError(HttpStatus.FORBIDDEN, "access_denied", "Chưa tới lượt hoặc lượt đã hết hạn");

    const existing = await this.findByKey(clientId, idempotencyKey);
    if (existing) return [existing, false];

    const [section] = await this.sql<{ eventId: string; priceVnd: number; status: string }[]>`
      select s.event_id as "eventId", s.price_vnd::int as "priceVnd", e.status
      from sections s join events e on e.id = s.event_id where s.id = ${input.sectionId}`;
    if (!section) throw new ApiError(HttpStatus.NOT_FOUND, "section_not_found");
    if (section.eventId !== access.eventId) throw new ApiError(HttpStatus.FORBIDDEN, "access_denied", "Token của sự kiện khác");
    if (section.status !== "on_sale") throw new ApiError(HttpStatus.CONFLICT, "sales_closed");

    const email = input.email.trim().toLowerCase();
    let id: string | null;
    try {
      id = await this.sql.begin(async (tx) => {
        // Giới hạn vé theo email: khoá theo (sự kiện, email) để 2 đơn song song của cùng email không cùng lọt qua.
        await tx`select pg_advisory_xact_lock(hashtextextended(${section.eventId + ":" + email}, 0))`;
        const [{ taken }] = await tx<{ taken: number }[]>`
          select coalesce(sum(quantity), 0)::int as taken from orders
          where event_id = ${section.eventId} and lower(email) = ${email}
            and (status = 'confirmed' or (status = 'pending' and expires_at > now()))`;
        if (taken + input.quantity > env.SEATRUSH_MAX_TICKETS) {
          throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, "ticket_limit", `Mỗi email tối đa ${env.SEATRUSH_MAX_TICKETS} vé cho sự kiện này`);
        }

        const [order] = await tx<{ id: string }[]>`
          insert into orders (event_id, section_id, client_id, idempotency_key, email, quantity, amount_vnd, expires_at)
          values (${section.eventId}, ${input.sectionId}, ${clientId}, ${idempotencyKey}, ${email}, ${input.quantity},
                  ${section.priceVnd * input.quantity}, now() + make_interval(mins => ${env.SEATRUSH_HOLD_MINUTES}))
          on conflict (client_id, idempotency_key) do nothing
          returning id`;
        // Request trùng key chạy song song đã commit trước → trả đơn của nó.
        if (!order) return null;

        // ADR 0001: mỗi request khoá một nhóm ghế khác nhau (SKIP LOCKED), không xếp hàng chờ nhau.
        // Ghế giữ đã hết hạn cũng lấy được → không phụ thuộc job dọn.
        const held = await tx`
          with picked as (
            select id from seats
            where section_id = ${input.sectionId}
              and (status = 'available' or (status = 'held' and held_until < now()))
            order by row_no, seat_no
            limit ${input.quantity}
            for update skip locked
          )
          update seats s set status = 'held', order_id = ${order.id}, held_until = now() + make_interval(mins => ${env.SEATRUSH_HOLD_MINUTES})
          from picked where s.id = picked.id
          returning s.id`;
        if (held.length < input.quantity) throw new ApiError(HttpStatus.CONFLICT, "not_enough_seats");
        return order.id;
      });
    } catch (err) {
      if (err instanceof ApiError) track("hold_failed", err.code);
      throw err;
    }

    if (!id) {
      const dup = await this.findByKey(clientId, idempotencyKey);
      if (!dup) throw new Error("idempotent order vanished");
      return [dup, false];
    }
    track("hold_created");
    return [await this.load(id), true];
  }

  private async findByKey(clientId: string, key: string): Promise<OrderDto | null> {
    const [row] = await this.sql<{ id: string }[]>`select id from orders where client_id = ${clientId} and idempotency_key = ${key}`;
    return row ? this.load(row.id) : null;
  }

  async get(id: string, clientId: string): Promise<OrderDto> {
    const [row] = await this.sql<{ id: string }[]>`select id from orders where id = ${id} and client_id = ${clientId}`;
    if (!row) throw new ApiError(HttpStatus.NOT_FOUND, "order_not_found");
    return this.load(id);
  }

  async load(id: string): Promise<OrderDto> {
    const [order] = await this.sql<OrderRow[]>`select ${this.sql.unsafe(ORDER_COLUMNS)} from orders where id = ${id}`;
    if (!order) throw new ApiError(HttpStatus.NOT_FOUND, "order_not_found");
    const seats =
      order.status === "confirmed"
        ? await this.sql<{ label: string; code: string }[]>`
            select st.row_label || '-' || lpad(st.seat_no::text, 2, '0') as label, t.code
            from tickets t join seats st on st.id = t.seat_id where t.order_id = ${id} order by st.row_no, st.seat_no`
        : order.status === "pending"
          ? await this.sql<{ label: string; code: null }[]>`
              select row_label || '-' || lpad(seat_no::text, 2, '0') as label, null as code
              from seats where order_id = ${id} and status = 'held' order by row_no, seat_no`
          : [];
    return { ...order, seats: seats.map((s) => s.label), tickets: seats.flatMap((s) => (s.code ? [s.code] : [])) };
  }

  // HLD-04: đơn quá hạn → expired, trả ghế (chỉ ghế còn thuộc đơn này), phát order.expired — một câu lệnh, một transaction.
  async expireDue(limit = 500): Promise<number> {
    const rows = await this.sql`
      with due as (
        select id from orders where status = 'pending' and expires_at < now()
        order by expires_at limit ${limit} for update skip locked
      ), exp as (
        update orders o set status = 'expired' from due where o.id = due.id
        returning o.id, o.code, o.email
      ), freed as (
        update seats s set status = 'available', order_id = null, held_until = null
        from exp where s.order_id = exp.id and s.status = 'held'
        returning s.id
      )
      insert into outbox (topic, aggregate_id, payload)
      select 'order.expired', exp.id, jsonb_build_object('orderId', exp.id, 'code', exp.code, 'email', exp.email) from exp
      returning id`;
    for (let i = 0; i < rows.length; i++) track("order_expired");
    return rows.length;
  }
}
