// Direct client for janaushadhi.gov.in's own Kendra-locator API — not a
// Bright Data collector. Reverse-engineered from the site's own JS bundle
// (main.5d300851.js -> chunk 1824), since the page itself is a JS-only SPA
// with no server-rendered data (the reason this project uses pmbi.co.in for
// product data instead, per docs/targets.md), but the underlying API it
// calls is a plain public JSON endpoint: a short-lived guest token, then a
// POST that returns every Kendra for a state. No anti-bot posture, no JS
// rendering needed to reach it, so routing it through Bright Data would add
// cost with no technical benefit.
const API_BASE = "https://janaushadhi.gov.in:8443";

export interface RawKendra {
  id: number;
  storeCode: string;
  kendraAddress: string;
  pinCode: number | null;
  districtName: string | null;
  stateName: string;
  contactPerson: string | null;
  contactNumber: string | null;
  latitude: string | null;
  longitude: string | null;
  status: number;
}

async function getGuestToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/generateGuestToken`);
  if (!res.ok) throw new Error(`generateGuestToken failed: ${res.status}`);
  const body = (await res.json()) as { responseBody: string };
  return body.responseBody;
}

// stateId is this API's own internal numbering (confirmed by probing, not
// documented) — 19 is West Bengal. Not the same id space as the site's
// separate getAllStateOfIndia endpoint.
export async function fetchKendrasByState(stateId: number): Promise<RawKendra[]> {
  const token = await getGuestToken();
  const res = await fetch(`${API_BASE}/api/v1/website/getAllKendraByStateDistrict`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ pageIndex: 0, pageSize: 0, stateId: String(stateId), districtId: null, pinCode: 0, storeCode: "" }),
  });
  if (!res.ok) throw new Error(`getAllKendraByStateDistrict failed: ${res.status}`);
  const body = (await res.json()) as {
    responseCode: number;
    message: string;
    responseBody: { addKendraResponseList: RawKendra[] | null };
  };
  if (body.responseCode !== 200 || !body.responseBody.addKendraResponseList) {
    throw new Error(`getAllKendraByStateDistrict: ${body.message}`);
  }
  return body.responseBody.addKendraResponseList;
}
