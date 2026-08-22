import "dotenv/config";
import { execFileSync } from "node:child_process";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { healEvent, retailer } from "../src/db/schema";

// Wraps `brightdata scraper heal` so healing a collector always leaves a
// heal_event row behind instead of relying on someone writing it down later.
//
// Usage:
//   pnpm heal:log --collector=<id> --symptom="<what's wrong>" --prompt="<heal prompt>" \
//     [--retailer=<slug>] [--field=<field name>] [--url=<verify url>] \
//     [--rows-before=<n>] [--auto-approve] [--timeout=<seconds>]

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found?.slice(prefix.length);
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const collectorId = arg("collector");
  const symptom = arg("symptom");
  const healPrompt = arg("prompt");
  if (!collectorId || !symptom || !healPrompt) {
    console.error(
      'Usage: pnpm heal:log --collector=<id> --symptom="<what\'s wrong>" --prompt="<heal prompt>" [--retailer=<slug>] [--field=<name>] [--url=<verify url>] [--rows-before=<n>] [--auto-approve]',
    );
    process.exit(1);
  }

  const retailerSlug = arg("retailer");
  const fieldName = arg("field") ?? null;
  const verifyUrl = arg("url");
  const rowsBeforeArg = arg("rows-before");
  const rowsBefore = rowsBeforeArg ? Number(rowsBeforeArg) : null;
  const autoApprove = flag("auto-approve");
  const timeout = arg("timeout");

  let retailerId: number | null = null;
  if (retailerSlug) {
    const [row] = await db.select({ id: retailer.id }).from(retailer).where(eq(retailer.slug, retailerSlug));
    if (!row) throw new Error(`retailer '${retailerSlug}' not seeded — run pnpm db:seed first`);
    retailerId = row.id;
  }

  const healArgs = ["@brightdata/cli", "scraper", "heal", collectorId, healPrompt, "--json"];
  if (verifyUrl) healArgs.push("--url", verifyUrl);
  if (autoApprove) healArgs.push("--auto-approve", "--auto-save");
  if (timeout) healArgs.push("--timeout", timeout);

  console.log(`[heal:log] running: npx ${healArgs.join(" ")}`);
  const healOut = execFileSync("npx", healArgs, { encoding: "utf-8", maxBuffer: 1024 * 1024 * 32 });
  const healResult = JSON.parse(healOut);
  console.log(`[heal:log] heal status: ${healResult.status ?? "unknown"}`);

  let rowsAfter: number | null = null;
  if (verifyUrl && (!autoApprove || healResult.status === "done" || healResult.status === "completed")) {
    try {
      const runOut = execFileSync("npx", ["@brightdata/cli", "scraper", "run", collectorId, verifyUrl, "--json"], {
        encoding: "utf-8",
      });
      const runResult = JSON.parse(runOut);
      rowsAfter = Array.isArray(runResult) ? runResult.length : null;
      console.log(`[heal:log] verify run against ${verifyUrl} -> ${rowsAfter ?? "unknown"} rows`);
    } catch (err) {
      console.warn(`[heal:log] verify run failed, logging heal_event without rows_after:`, err);
    }
  }

  const [row] = await db
    .insert(healEvent)
    .values({
      retailerId,
      collectorId,
      fieldName,
      symptom,
      healPrompt,
      rowsBefore,
      rowsAfter,
      healedAt: autoApprove ? new Date() : null,
    })
    .returning({ id: healEvent.id });

  console.log(`[heal:log] wrote heal_event id=${row.id}${autoApprove ? "" : " (healedAt null — heal is pending approval; update the row once you `scraper approve` it)"}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
