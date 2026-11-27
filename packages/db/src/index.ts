import postgres from "postgres";

export type Sql = postgres.Sql;

export function createSql(url: string, max = 10): Sql {
  return postgres(url, { max, idle_timeout: 20, onnotice: () => {} });
}

export { migrate } from "./migrate-lib.js";
export { createEvent, rowLabel, type NewEvent, type NewSection } from "./seed-lib.js";
