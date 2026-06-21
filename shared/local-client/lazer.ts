import { config } from './config.js';

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
  return query('/api/lazer/scores', rql, depth);
}

export async function queryBeatmaps(rql: string, depth = 0): Promise<QueryResult> {
  return query('/api/lazer/beatmaps', rql, depth);
}

export async function queryBeatmapSets(rql: string, depth = 0): Promise<QueryResult> {
  return query('/api/lazer/beatmapsets', rql, depth);
}

export async function queryCollections(rql: string, depth = 0): Promise<QueryResult> {
  return query('/api/lazer/collections', rql, depth);
}

export async function getFile(hash: string): Promise<Response> {
  const res = await fetch(`${config.baseUrl}/api/lazer/files/${encodeURIComponent(hash)}`);
  if (!res.ok) throw new Error(`File error: ${res.status} ${res.statusText}`);
  return res;
}

export async function getReplayFile(beatmapHash: string, createdAt: Date): Promise<ArrayBuffer> {
  const date1 = new Date(createdAt.getTime() - 1000).toISOString().slice(0, -5);
  const date2 = new Date(createdAt.getTime() + 1000).toISOString().slice(0, -5);
  console.log(`Querying for replay with BeatmapHash="${beatmapHash}" and Date between ${date1} and ${date2}`);
  const score = await queryScores(`BeatmapHash="${beatmapHash}" and Date>=${date1} and Date<=${date2}`, 1);
  if (score.count === 0) throw new Error('No matching score found');
  const replayHash = score.items[0].Hash as string;
  const res = await getFile(replayHash);
  return await res.arrayBuffer();
}