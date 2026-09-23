import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export function dbPath(): string {
  return process.env.DB_PATH ?? "./data/app.db";
}

export function getDb(p = dbPath()) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const sqlite = new Database(p);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof getDb>;
