import type { Sql } from "./index.js";

export type NewSection = { name: string; priceVnd: number; rows: number; seatsPerRow: number };
export type NewEvent = { slug: string; name: string; venue: string; startsAt: Date; salesOpenAt: Date; sections: NewSection[] };

// Hàng đặt tên A, B, …, Z, AA, AB…; ghế đánh số từ 1.
export const rowLabel = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : rowLabel(Math.floor(i / 26) - 1) + rowLabel(i % 26));

export async function createEvent(sql: Sql, e: NewEvent, status = "on_sale"): Promise<string> {
  return sql.begin(async (tx) => {
    const [ev] = await tx<{ id: string }[]>`
      insert into events (slug, name, venue, starts_at, sales_open_at, status)
      values (${e.slug}, ${e.name}, ${e.venue}, ${e.startsAt}, ${e.salesOpenAt}, ${status}) returning id`;
    for (const [sort, s] of e.sections.entries()) {
      const [sec] = await tx<{ id: string }[]>`
        insert into sections (event_id, name, price_vnd, sort) values (${ev.id}, ${s.name}, ${s.priceVnd}, ${sort}) returning id`;
      const rows = Array.from({ length: s.rows }, (_, i) => rowLabel(i));
      await tx`
        insert into seats (event_id, section_id, row_label, row_no, seat_no)
        select ${ev.id}, ${sec.id}, r.label, r.no, n
        from unnest(${rows}::text[]) with ordinality as r(label, no), generate_series(1, ${s.seatsPerRow}::int) n`;
    }
    return ev.id;
  });
}
