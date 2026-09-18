/**
 * CrossCheck API client.
 *
 * In production the SPA and the API share a CloudFront domain, so the default
 * base path is a same-origin `/api` and there is no CORS preflight. In local
 * development set VITE_API_BASE_URL to the deployed HttpApi endpoint.
 *
 * Every call is failure-tolerant on purpose: if the backend is unreachable the
 * UI falls back to the dataset bundled in the client, so the demo never shows
 * an empty map.
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/+$/, "");

/**
 * The API is used when it is actually reachable.
 *
 * - `VITE_API_ENABLED=false` disables it outright.
 * - In dev with no `VITE_API_BASE_URL`, it stays off, so `npm run dev` works
 *   against the bundled dataset with no failed requests and no backend.
 * - In a production build it is on, because CloudFront serves `/api` on the
 *   same origin as the site.
 */
export const API_ENABLED =
  import.meta.env.VITE_API_ENABLED !== "false" &&
  (!import.meta.env.DEV || Boolean(import.meta.env.VITE_API_BASE_URL));

export interface ApiSummary {
  projectCount: number;
  collisionCount: number;
  agencyCount: number;
  agencies: string[];
  overlapMeters: number;
  overlapDays: number;
  avoidableCrore: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText} ${detail}`.trim());
  }

  return (await response.json()) as T;
}

/** GET /projects — the authoritative dataset. */
export function fetchProjects<TProject>(datasetId?: string) {
  const query = datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : "";
  return request<{ datasetId: string; projects: TProject[]; summary: ApiSummary }>(
    `/projects${query}`,
  );
}

/** GET /collisions — server-computed collisions for the dataset. */
export function fetchCollisions<TCollision>(datasetId?: string) {
  const query = datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : "";
  return request<{ datasetId: string; collisions: TCollision[]; summary: ApiSummary }>(
    `/collisions${query}`,
  );
}

/** POST /datasets — archives to S3, stores in DynamoDB, returns recomputed collisions. */
export function uploadDataset<TProject, TCollision>(filename: string, content: string) {
  return request<{
    datasetId: string;
    accepted: number;
    projects: TProject[];
    collisions: TCollision[];
    summary: ApiSummary;
  }>("/datasets", {
    method: "POST",
    body: JSON.stringify({ filename, content }),
  });
}

/** POST /assistant — grounded answer over the dataset. */
export function askAssistant(question: string, datasetId?: string) {
  return request<{ answer: string; source: "bedrock" | "rules" }>("/assistant", {
    method: "POST",
    body: JSON.stringify({ question, datasetId }),
  });
}

/** Absolute URL for a downloadable brief, streamed straight from the API. */
export function briefUrl(collisionId: string, format: "brief" | "rti", datasetId?: string) {
  const query = new URLSearchParams({ format });
  if (datasetId) query.set("datasetId", datasetId);
  return `${API_BASE}/collisions/${encodeURIComponent(collisionId)}/brief?${query}`;
}
