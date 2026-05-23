import type { ScoreEntry } from 'osu-stable-db';
import { 
  readScoresDatabase, 
  getScoreRelativeOsrFilePath, 
  dateToDateTimeTicks, 
  dateTimeTicksToWindowsFileTimeTicks,
} from 'osu-stable-db';

export const config = {
  baseUrl: 'http://localhost:5167',
};

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${config.baseUrl}${path}`);
  if (!res.ok) throw new Error(`Stable server error: ${res.status} ${res.statusText}`);
  return res.json();
}

export interface StatusResult {
  available: boolean;
  osuRootPath: string;
}

export async function getStatus(): Promise<StatusResult> {
  return fetchJson<StatusResult>('/api/status');
}

export async function getFile(relativePath: string): Promise<ArrayBuffer> {
  const res = await fetch(`${config.baseUrl}/files/${relativePath.replace(/^\/+/, '')}`);
  if (!res.ok) throw new Error(`File error: ${res.status} ${res.statusText}`);
  return await res.arrayBuffer();
}

export async function findBeatmapScores(beatmapHash: string): Promise<ScoreEntry[]> {
  const file = await getFile('scores.db');
  const scoresDb = readScoresDatabase(file);
  return scoresDb.beatmaps.filter(b => b.beatmapMd5Hash === beatmapHash).flatMap(b => b.scores);
}

export async function getReplayFile(scoreEntry: ScoreEntry): Promise<ArrayBuffer> {
  const relativePath = getScoreRelativeOsrFilePath(scoreEntry);
  return await getFile(relativePath);
}

export async function getReplayFileWildcard(beatmapHash: string, createdAt: Date): Promise<ArrayBuffer> {
  const ticks = dateTimeTicksToWindowsFileTimeTicks(dateToDateTimeTicks(createdAt));
  const ticksStr = ticks.toString().slice(0, -6) + '*';
  return await getFile(`Data/r/${beatmapHash}-${ticksStr}.osr`);
}