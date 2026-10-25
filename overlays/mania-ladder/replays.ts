import { dateTimeTicksToDate } from 'osu-stable-db';
import { lazer, stable } from '@/local-client';

export type ReplayClient = 'stable' | 'lazer';

export type ReplayRef = {
  key: string;
  /** Milliseconds used to keep the most recent replays; 0 when unknown. */
  playedAt: number;
  /** Name reported by the score database, used when the replay file has none. */
  playerName?: string;
  load: () => Promise<ArrayBuffer>;
};

/** List the current client's local replays of a beatmap, most recent first. */
export async function listLocalReplays(
  client: ReplayClient,
  beatmapHash: string,
  lazerBeatmapHash: string,
  limit: number,
): Promise<ReplayRef[]> {
  const refs = client === 'lazer'
    ? await listLazerReplays(lazerBeatmapHash || beatmapHash, beatmapHash)
    : await listStableReplays(beatmapHash);

  return refs
    .sort((left, right) => right.playedAt - left.playedAt)
    .slice(0, Math.max(0, limit));
}

async function listStableReplays(beatmapHash: string): Promise<ReplayRef[]> {
  try {
    const files = await stable.listBeatmapReplayFiles(beatmapHash);
    return files.map(file => ({
      key: `stable:${file.name}`,
      playedAt: Date.parse(file.lastModified) || 0,
      load: () => stable.getFile(`Data/r/${file.name}`),
    }));
  } catch (error) {
    console.log('[mania-ladder] failed to list Data/r, falling back to scores.db', error);
  }

  const scores = await stable.findBeatmapScores(beatmapHash);
  return scores.map(score => ({
    key: `stable:${score.beatmapMd5Hash}-${score.replayTimestamp}`,
    playedAt: dateTimeTicksToDate(score.replayTimestamp).getTime(),
    load: () => stable.getReplayFile(score),
  }));
}

async function listLazerReplays(beatmapHash: string, fallbackBeatmapHash: string): Promise<ReplayRef[]> {
  let scores = await lazer.listBeatmapScores(beatmapHash);
  if (scores.length === 0 && fallbackBeatmapHash !== beatmapHash) {
    scores = await lazer.listBeatmapScores(fallbackBeatmapHash);
  }

  const seen = new Set<string>();
  const refs: ReplayRef[] = [];

  for (const score of scores) {
    if (score.deletePending || seen.has(score.hash)) continue;
    seen.add(score.hash);
    refs.push({
      key: `lazer:${score.hash}`,
      playedAt: score.date ? Date.parse(score.date) || 0 : 0,
      playerName: score.username || undefined,
      load: () => lazer.getReplayFileByHash(score.hash),
    });
  }

  return refs;
}
