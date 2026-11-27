import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Sql } from "./index.js";

const dir = fileURLToPath(new URL("../sql/", import.meta.url));

// Mỗi lần chạy là 1 transaction; advisory lock để 2 instance khởi động cùng lúc không migrate chồng.
export async function migrate(sql: Sql, log: (m: string) => void = () => {}): Promise<string[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(727274)`;
    await tx`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
    const done = new Set((await tx<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name));
    for (const f of files) {
      if (done.has(f)) continue;
      await tx.unsafe(await readFile(dir + f, "utf8"));
      await tx`insert into schema_migrations (name) values (${f})`;
      applied.push(f);
      log(`applied ${f}`);
    }
  });
  return applied;
}
