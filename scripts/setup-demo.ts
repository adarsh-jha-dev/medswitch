import "dotenv/config";
import { execFileSync } from "node:child_process";
import postgres from "postgres";

// One-command path for anyone evaluating this without a Bright Data account:
// migrate the schema, then load docs/demo-fixture.sql — a real snapshot of
// the parsed database (369 listings, 156 CDSCO banned-FDC notifications, the
// confirmed Camylofin match, 3 heal_events), not synthetic demo data. The
// full ingest -> parse -> match pipeline documented in the README still runs
// against a live Bright Data account for anyone who wants to reproduce it.

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — copy .env.example to .env first.");
  }

  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const [{ count }] = await sql<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'composition'`;
  if (count > 0) {
    const [{ n }] = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM composition`;
    if (n > 0) {
      console.log(`[setup:demo] composition table already has ${n} rows — skipping, nothing to do.`);
      console.log("[setup:demo] to reload from scratch, point DATABASE_URL at an empty database first.");
      await sql.end();
      process.exit(0);
    }
  }
  await sql.end();

  console.log("[setup:demo] applying migrations...");
  execFileSync("pnpm", ["db:migrate"], { stdio: "inherit" });

  console.log("[setup:demo] loading demo fixture (docs/demo-fixture.sql)...");
  const loader = postgres(process.env.DATABASE_URL, { max: 1 });
  await loader.file(new URL("../docs/demo-fixture.sql", import.meta.url).pathname);
  await loader.end();

  console.log("[setup:demo] done — run `pnpm dev` and search \"Camylofin\", or open /safety.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
