import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// idle_timeout closes our own idle connections after 20s so we never hand a
// query to a socket Neon's pooler has already silently dropped — ingestion
// batches can sit for minutes between DB calls while a collector runs.
const client = postgres(process.env.DATABASE_URL, { max: 10, idle_timeout: 20 });

export const db = drizzle(client, { schema });
export { schema };
