import "dotenv/config";
import { db } from "../src/db";
import { kendra } from "../src/db/schema";
import { fetchKendrasByState } from "../src/ingest/kendra-api";

// West Bengal (this API's own internal stateId, found by probing — not the
// same id space as its separate getAllStateOfIndia endpoint), scoped to the
// Kolkata district: the rest of the project only ever scrapes pincode
// 700001, so a nationwide fetch (~19k rows) would be scope without purpose.
const WEST_BENGAL_STATE_ID = 19;
const DISTRICT = "Kolkata";

// Idempotent: upserts on store_code, safe to re-run.
async function main() {
  console.log(`[kendra] fetching West Bengal kendras from janaushadhi.gov.in...`);
  const raw = await fetchKendrasByState(WEST_BENGAL_STATE_ID);
  const kolkata = raw.filter((k) => k.status === 1 && k.districtName === DISTRICT);
  console.log(`[kendra] ${raw.length} West Bengal rows -> ${kolkata.length} active ${DISTRICT} rows`);

  for (const k of kolkata) {
    const values = {
      sourceId: k.id,
      storeCode: k.storeCode,
      address: k.kendraAddress,
      pincode: k.pinCode !== null ? String(k.pinCode) : null,
      district: k.districtName,
      state: k.stateName,
      contactPerson: k.contactPerson,
      contactNumber: k.contactNumber,
      latitude: k.latitude && k.latitude !== "0" ? k.latitude : null,
      longitude: k.longitude && k.longitude !== "0" ? k.longitude : null,
    };
    await db.insert(kendra).values(values).onConflictDoUpdate({ target: kendra.storeCode, set: values });
  }

  console.log(`[kendra] done: ${kolkata.length} rows upserted.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
