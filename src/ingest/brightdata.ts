const API_BASE = "https://api.brightdata.com";
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 5 * 60_000;

export class BrightDataError extends Error {}

function apiToken(): string {
  const token = process.env.BRIGHTDATA_API_TOKEN;
  if (!token) throw new BrightDataError("BRIGHTDATA_API_TOKEN is not set");
  return token;
}

async function fetchWithBackoff(url: string, init: RequestInit, maxAttempts = 5): Promise<Response> {
  let attempt = 0;
  for (;;) {
    const res = await fetch(url, init);
    if (res.status < 500 && res.status !== 429) return res;
    attempt += 1;
    if (attempt >= maxAttempts) return res;
    const delayMs = 1_000 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

// Triggers a job, then polls /dca/dataset until a finished (non-empty array) snapshot or timeout.
export async function runCollector(collectorId: string, urls: string[]): Promise<unknown[]> {
  const token = apiToken();

  const triggerRes = await fetchWithBackoff(
    `${API_BASE}/dca/trigger?collector=${encodeURIComponent(collectorId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(urls.map((url) => ({ url }))),
    },
  );

  if (!triggerRes.ok) {
    throw new BrightDataError(
      `trigger failed for collector ${collectorId}: ${triggerRes.status} ${await triggerRes.text()}`,
    );
  }

  const { collection_id: collectionId } = (await triggerRes.json()) as { collection_id: string };
  if (!collectionId) {
    throw new BrightDataError(`trigger response for ${collectorId} had no collection_id`);
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const pollRes = await fetchWithBackoff(`${API_BASE}/dca/dataset?id=${encodeURIComponent(collectionId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!pollRes.ok) {
      throw new BrightDataError(`poll failed for snapshot ${collectionId}: ${pollRes.status}`);
    }

    const body = (await pollRes.json()) as unknown;
    if (Array.isArray(body) && body.length > 0) return body;
  }

  throw new BrightDataError(`snapshot ${collectionId} did not finish within ${POLL_TIMEOUT_MS}ms`);
}
