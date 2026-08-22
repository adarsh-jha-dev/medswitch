import { ImageResponse } from "next/og";
import { computeSavings, getSubstitutionGroup } from "../../../src/queries/substitution";
import { formatRupeesWhole } from "../../../src/lib/format";

export const alt = "MedSwitch price comparison";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND = "#b5480f";
const INK = "#1a1a1a";
const MUTED = "#5b5b5b";

export default async function Image({ params }: { params: Promise<{ fingerprint: string }> }) {
  const { fingerprint } = await params;
  const group = await getSubstitutionGroup(fingerprint);
  const savings = group ? computeSavings(group.ranked) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px",
          background: "#fdfbf8",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: BRAND }}>MedSwitch</div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 600, color: INK, maxWidth: 1000 }}>
            {group ? group.normalizedText : "Composition not found"}
          </div>

          {savings ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "flex-end", marginTop: 28 }}>
                <div style={{ display: "flex", fontSize: 112, fontWeight: 700, color: BRAND }}>
                  {formatRupeesWhole(savings.annualSaving)}
                </div>
                <div style={{ display: "flex", fontSize: 34, fontWeight: 500, color: INK, marginLeft: 16, marginBottom: 20 }}>
                  /year cheaper
                </div>
              </div>
              <div style={{ display: "flex", fontSize: 28, color: MUTED, marginTop: 12 }}>
                {savings.pctCheaper}% cheaper at {savings.cheapest.retailer} than the priciest listed alternative ({savings.priciest.retailer})
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 30, color: MUTED, marginTop: 28 }}>
              Real pharmacy prices, compared across retailers
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
