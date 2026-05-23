import { test, expect } from 'vitest';
import { findBeatmapScores, getReplayFile, getReplayFileWildcard } from '@/local-client/stable';

const beatmapHash = '29278f227275b1720e995d532130710b';

test('findBeatmapScores', async () => {
  const scores = await findBeatmapScores(beatmapHash);
  console.log(scores);
});

test('getReplayFile', async () => {
  const scores = await findBeatmapScores(beatmapHash);
  const latestScore = scores.reduce((latest, current) => {
    return current.replayTimestamp > latest.replayTimestamp ? current : latest;
  });

  const result = await getReplayFile(latestScore);
  expect(result).toBeInstanceOf(ArrayBuffer);
});

test('getReplayFileWildcard', async () => {
  const result = await getReplayFileWildcard(beatmapHash, new Date('2025-10-04T06:58:56.149Z'));
  expect(result).toBeInstanceOf(ArrayBuffer);
});