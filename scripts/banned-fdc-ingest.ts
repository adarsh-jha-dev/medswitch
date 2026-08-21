import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { bannedFdc, bannedFdcMolecule } from "../src/db/schema";
import { BANNED_FDC_2024, BANNED_FDC_SOURCE_URL } from "../src/parse/banned-fdc-data";
import { parseBannedFdcComponents } from "../src/parse/banned-fdc-parse";
import { moleculeSetHash } from "../src/parse/fingerprint";
import { resolveMolecule } from "../src/parse/resolve";

// Idempotent: re-running re-derives molecule_set_hash without duplicating banned_fdc rows (upserted on notification_ref).
async function main() {
  let inserted = 0;
  let updated = 0;

  for (const item of BANNED_FDC_2024) {
    const components = parseBannedFdcComponents(item.rawText);
    const resolved = await Promise.all(
      components.map(async (c) => ({ ...c, moleculeId: (await resolveMolecule(c.name)).moleculeId })),
    );

    const setHash = moleculeSetHash(resolved.map((r) => r.moleculeId));

    const [existing] = await db
      .select({ id: bannedFdc.id })
      .from(bannedFdc)
      .where(eq(bannedFdc.notificationRef, item.notificationRef));

    let bannedFdcId: number;
    if (existing) {
      await db
        .update(bannedFdc)
        .set({ moleculeSetHash: setHash, rawText: item.rawText })
        .where(eq(bannedFdc.id, existing.id));
      bannedFdcId = existing.id;
      updated++;
    } else {
      const [row] = await db
        .insert(bannedFdc)
        .values({
          notificationRef: item.notificationRef,
          notificationDate: new Date(item.notificationDate),
          rawText: item.rawText,
          moleculeSetHash: setHash,
          status: "prohibited",
          sourceUrl: BANNED_FDC_SOURCE_URL,
        })
        .returning({ id: bannedFdc.id });
      bannedFdcId = row.id;
      inserted++;
    }

    for (const r of resolved) {
      await db
        .insert(bannedFdcMolecule)
        .values({
          bannedFdcId,
          moleculeId: r.moleculeId,
          strengthMg: r.strengthMg !== null ? r.strengthMg.toFixed(3) : null,
        })
        .onConflictDoUpdate({
          target: [bannedFdcMolecule.bannedFdcId, bannedFdcMolecule.moleculeId],
          set: { strengthMg: r.strengthMg !== null ? r.strengthMg.toFixed(3) : null },
        });
    }
  }

  console.log(`banned_fdc: ${inserted} inserted, ${updated} updated (${BANNED_FDC_2024.length} total in the 2024 tranche).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
