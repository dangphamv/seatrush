import { createSql, migrate } from "./index.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = createSql(url, 1);
const applied = await migrate(sql, console.log);
console.log(applied.length ? `${applied.length} migration(s) applied` : "up to date");
await sql.end();
