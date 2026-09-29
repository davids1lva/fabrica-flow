import { readFile } from "node:fs/promises";
import { openDB } from "./db.js";
export async function migrate(db) {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const { rows } = await db.query(
    "SELECT version FROM schema_migrations WHERE version=1",
  );
  if (!rows.length)
    await db.tx(async (t) => {
      for (const sql of (
        await readFile(new URL("../db/001_init.sql", import.meta.url), "utf8")
      )
        .split(";")
        .filter((s) => s.trim()))
        await t.query(sql);
    });
}
if (process.argv[1]?.endsWith("/migrate.js")) {
  const db = await openDB();
  await migrate(db);
  await db.close();
  console.log("Migration 001 aplicada.");
}
