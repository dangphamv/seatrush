import { createEvent, createSql } from "./index.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = createSql(url, 1);
const slug = process.argv[2] ?? "dem-nhac-mua-dong";
await sql`delete from events where slug = ${slug}`;
const id = await createEvent(sql, {
  slug,
  name: "Đêm Nhạc Mùa Đông 2026",
  venue: "Sân vận động Demo, TP.HCM",
  startsAt: new Date(Date.now() + 30 * 86400_000),
  salesOpenAt: new Date(Date.now() - 60_000),
  sections: [
    { name: "VIP", priceVnd: 3_500_000, rows: 5, seatsPerRow: 20 },
    { name: "GA A", priceVnd: 1_800_000, rows: 20, seatsPerRow: 25 },
    { name: "GA B", priceVnd: 900_000, rows: 20, seatsPerRow: 25 },
  ],
});
console.log(`seeded event ${slug} (${id})`);
await sql.end();
