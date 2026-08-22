import { sql } from "drizzle-orm";
import { db } from "../db";

export interface NearestKendra {
  storeCode: string;
  address: string;
  pincode: string | null;
  contactNumber: string | null;
  distanceKm: number | null;
}

// Ranked by real haversine distance from the reference pincode's own
// coordinates (a scraped point, not a guess) when we have one; otherwise by
// how close the pincode number itself is, which is a reasonable fallback
// within one postal district but not a real distance.
export async function nearestKendras(pincode: string, limit = 5): Promise<NearestKendra[]> {
  const rows = await db.execute<{
    store_code: string;
    address: string;
    pincode: string | null;
    contact_number: string | null;
    distance_km: string | null;
  }>(sql`
    WITH reference AS (
      SELECT latitude, longitude FROM kendra
      WHERE pincode = ${pincode} AND latitude IS NOT NULL AND longitude IS NOT NULL
      LIMIT 1
    )
    SELECT
      k.store_code,
      k.address,
      k.pincode,
      k.contact_number,
      CASE
        WHEN r.latitude IS NOT NULL AND k.latitude IS NOT NULL THEN
          ROUND(
            (6371 * acos(LEAST(1, GREATEST(-1,
              cos(radians(r.latitude)) * cos(radians(k.latitude)) * cos(radians(k.longitude) - radians(r.longitude))
              + sin(radians(r.latitude)) * sin(radians(k.latitude))
            ))))::numeric,
            1
          )
        ELSE NULL
      END AS distance_km
    FROM kendra k
    LEFT JOIN reference r ON TRUE
    ORDER BY
      distance_km ASC NULLS LAST,
      ABS(NULLIF(k.pincode, '')::int - ${pincode}::int) ASC NULLS LAST
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    storeCode: r.store_code,
    address: r.address,
    pincode: r.pincode,
    contactNumber: r.contact_number,
    distanceKm: r.distance_km === null ? null : Number(r.distance_km),
  }));
}
