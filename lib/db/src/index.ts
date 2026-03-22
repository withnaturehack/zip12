import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL (or NEON_DATABASE_URL) must be set. Did you forget to provision a database?");
}

export const pool = new Pool({
  connectionString,
  max: 50,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
  allowExitOnIdle: false,
});

pool.on("error", (err) => {
  console.error("[DB] Pool error:", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
