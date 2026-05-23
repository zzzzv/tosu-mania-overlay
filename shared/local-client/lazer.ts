export const config = {
  baseUrl: 'http://localhost:5048',
};

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${config.baseUrl}${path}`);
  if (!res.ok) throw new Error(`Lazer server error: ${res.status} ${res.statusText}`);
  return res.json();
}

export interface StatusResult {
  available: boolean;
  dataDirectory: string;
}

export async function getStatus(): Promise<StatusResult> {
  return fetchJson<StatusResult>('/api/status');
}

interface QueryResult {
  count: number;
  items: Record<string, unknown>[];
}

async function query(path: string, rql: string, depth = 0): Promise<QueryResult> {
  const params = new URLSearchParams({ rql, depth: String(depth) });
  const res = await fetch(`${config.baseUrl}${path}?${params}`);
  if (!res.ok) throw new Error(`Lazer server error: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function queryScores(rql: string, depth = 0): Promise<QueryResult> {
  return query('/api/scores', rql, depth);
}

export async function queryBeatmaps(rql: string, depth = 0): Promise<QueryResult> {
  return query('/api/beatmaps', rql, depth);
}

export async function queryBeatmapSets(rql: string, depth = 0): Promise<QueryResult> {
  return query('/api/beatmapsets', rql, depth);
}

export async function queryCollections(rql: string, depth = 0): Promise<QueryResult> {
  return query('/api/collections', rql, depth);
}

export async function getFile(hash: string): Promise<Response> {
  const res = await fetch(`${config.baseUrl}/files/${encodeURIComponent(hash)}`);
  if (!res.ok) throw new Error(`File error: ${res.status} ${res.statusText}`);
  return res;
}
