import { config } from './config';

interface QueryResult {
  count: number;
  items: Record<string, unknown>[];
}

async function query(
  path: string,
  rql: string,
  depth = 0,
  noExpand: readonly string[] = [],
): Promise<QueryResult> {
  const params = new URLSearchParams({ rql, depth: String(depth) });
  for (const field of noExpand) {
    params.append('noExpand', field);
  }

  const res = await fetch(`${config.baseUrl}${path}?${params}`);
  if (!res.ok) throw new Error(`Lazer server error: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function queryScores(
  rql: string,
  depth = 0,
  noExpand: readonly string[] = [],
): Promise<QueryResult> {
  return query('/api/lazer/scores', rql, depth, noExpand);
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

export async function getReplayFileByHash(hash: string): Promise<ArrayBuffer> {
  const res = await getFile(hash);
  return await res.arrayBuffer();
}

export interface BeatmapScore {
  hash: string;
  username: string;
  date: string | null;
  deletePending: boolean;
}

export async function listBeatmapScores(beatmapHash: string): Promise<BeatmapScore[]> {
  const result = await queryScores(`BeatmapHash="${beatmapHash}"`, 1, [
    'BeatmapInfo',
    'Files',
    'Ruleset',
  ]);

  return result.items.flatMap((item) => {
    const hash = typeof item.Hash === 'string' ? item.Hash : '';
    if (!hash) return [];

    // `User` was renamed to `RealmUser` in newer lazer schemas.
    const user = item.RealmUser ?? item.User;
    let username = '';
    if (typeof user === 'string') {
      username = user;
    } else if (typeof user === 'object' && user !== null && 'Username' in user) {
      username = String((user as { Username?: unknown }).Username ?? '');
    }

    return [{
      hash,
      username,
      date: typeof item.Date === 'string' ? item.Date : null,
      deletePending: item.DeletePending === true,
    }];
  });
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