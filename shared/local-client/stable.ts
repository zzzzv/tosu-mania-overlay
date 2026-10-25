import type { ScoreEntry } from 'osu-stable-db';
import { 
  readScoresDatabase, 
  getScoreRelativeOsrFilePath, 
  dateToDateTimeTicks, 
  dateTimeTicksToWindowsFileTimeTicks,
} from 'osu-stable-db';

import { config } from './config';

export interface FolderFile {
  name: string;
  size: number;
  lastModified: string;
}

export async function getFile(relativePath: string): Promise<ArrayBuffer> {
  const res = await fetch(`${config.baseUrl}/api/stable/files/${relativePath.replace(/^\/+/, '')}`);
  if (!res.ok) throw new Error(`File error: ${res.status} ${res.statusText}`);
  return await res.arrayBuffer();
}

export async function listFolder(relativePath: string): Promise<FolderFile[]> {
  const res = await fetch(`${config.baseUrl}/api/stable/folder/${relativePath.replace(/^\/+/, '')}`);
  if (!res.ok) throw new Error(`Folder error: ${res.status} ${res.statusText}`);

  const data = await res.json() as { files?: FolderFile[] };
  return data.files ?? [];
}

export async function listBeatmapReplayFiles(beatmapHash: string): Promise<FolderFile[]> {
  const files = await listFolder('Data/r');
  return files
    .filter(file => file.name.startsWith(`${beatmapHash}-`) && file.name.endsWith('.osr'))
    .sort((left, right) => (Date.parse(right.lastModified) || 0) - (Date.parse(left.lastModified) || 0));
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