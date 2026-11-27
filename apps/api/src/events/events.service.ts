import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { createEvent, type NewEvent } from "@seatrush/db";
import { ApiError } from "../common/errors.js";
import { SQL, type Sql } from "../common/infra.module.js";

export type EventRow = { id: string; slug: string; name: string; venue: string; startsAt: Date; salesOpenAt: Date; status: string };

@Injectable()
export class EventsService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  list() {
    return this.sql<EventRow[]>`
      select id, slug, name, venue, starts_at as "startsAt", sales_open_at as "salesOpenAt", status
      from events where status = 'on_sale' order by sales_open_at, starts_at`;
  }

  async get(id: string): Promise<EventRow> {
    const [ev] = await this.sql<EventRow[]>`
      select id, slug, name, venue, starts_at as "startsAt", sales_open_at as "salesOpenAt", status
      from events where id = ${id} and status <> 'draft'`;
    if (!ev) throw new ApiError(HttpStatus.NOT_FOUND, "event_not_found");
    return ev;
  }

  async detail(id: string) {
    const ev = await this.get(id);
    // Ghế giữ đã hết hạn vẫn tính là còn: job dọn có thể chưa chạy, nhưng bước giữ ghế lấy được chúng (ADR 0001).
    const sections = await this.sql<{ id: string; name: string; priceVnd: number; total: number; available: number }[]>`
      select s.id, s.name, s.price_vnd::int as "priceVnd", count(st.id)::int as total,
             count(st.id) filter (where st.status = 'available' or (st.status = 'held' and st.held_until < now()))::int as available
      from sections s join seats st on st.section_id = s.id
      where s.event_id = ${id}
      group by s.id order by s.sort`;
    return { ...ev, sections };
  }

  async create(e: NewEvent) {
    try {
      return await this.detail(await createEvent(this.sql, e));
    } catch (err) {
      if ((err as { code?: string }).code === "23505") throw new ApiError(HttpStatus.CONFLICT, "slug_taken");
      throw err;
    }
  }
}
