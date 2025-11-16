import { test } from 'vitest';
import { readFile } from 'fs/promises';
import { ManiaReplayFrame, ManiaBeatmap } from 'osu-mania-stable';
import { osuApi } from '@/osu-api';
import { parseBeatmap, parseReplay } from '@/parsers';

const readBeatmap = async (path: string) => {
  const text = await readFile(path, 'utf-8');
  return parseBeatmap(text);
}

const readReplay = async (path: string, beatmap: ManiaBeatmap) => {
  const buffer = await readFile(path);
  return parseReplay(buffer, beatmap);
}

const fixtureDir = 'tests/fixtures/score-635785967';

test('api v2', async () => {
  const clientId = process.env.OSU_CLIENT_ID;
  const clientSecret = process.env.OSU_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing OSU_CLIENT_ID or OSU_CLIENT_SECRET in .env file');
  }

  await osuApi.auth(clientId, clientSecret);
  const rawScore = await osuApi.getScore('mania', 635785967);
  const beatmap = await readBeatmap(`${fixtureDir}/beatmap.osu`);
  const score = await parseReplay(rawScore, beatmap);
  console.log(score);
});

test('decodeReplay', async () => {
  const beatmap = await readBeatmap(`${fixtureDir}/beatmap.osu`);
  const replay = await readReplay(`${fixtureDir}/replay.osr`, beatmap);
  console.log(Array.from(replay.frames)
    .filter(p => (p as ManiaReplayFrame)
    .actions.size > 0).slice(0, 100));
});
