import { defineConfig } from "drizzle-kit";
import path from "path";

const pass = process.env.NEON_DB_PASSWORD ? encodeURIComponent(process.env.NEON_DB_PASSWORD) : null;
const url = pass
  ? `postgresql://neondb_owner:${pass}@ep-little-haze-ant4ajfa-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
  : (process.env.NEON_DATABASE_URL?.startsWith("postgresql://") ? process.env.NEON_DATABASE_URL : process.env.DATABASE_URL);

if (!url) {
  throw new Error("DATABASE_URL or NEON_DATABASE_URL must be set. Did you forget to provision a database?");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: { url },
});
