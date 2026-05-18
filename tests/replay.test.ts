import { test } from 'vitest';
import { readFile, writeFile } from 'fs/promises';
import { fetchReplayLZMA, encodeScoreBuffer } from '@/osu-api';
import type { WEBSOCKET_V2 } from '@/lib/socket';
import { ScoreDecoder } from 'osu-parsers';

const fixtureDir = 'tests/fixtures/score-635785967';

test('api v1', async () => {
  const apiKey = process.env.OSU_API_KEY;

  if (!apiKey) {
    throw new Error('Missing OSU_API_KEY in .env file');
  }

  const data: WEBSOCKET_V2 = await readFile(`${fixtureDir}/v2.json`, 'utf-8').then(JSON.parse);

  const lzmaData = await fetchReplayLZMA(apiKey, data.resultsScreen.mode.number, data.resultsScreen.scoreId);
  await writeFile(`${fixtureDir}/replay.lzma`, lzmaData);
  
  console.log(lzmaData);
});

test('decodeReplay', async () => {
  const data: WEBSOCKET_V2 = await readFile(`${fixtureDir}/v2.json`, 'utf-8').then(JSON.parse);
  const lzmaData = await readFile(`${fixtureDir}/replay.lzma`);
  const scoreBuffer = encodeScoreBuffer(data, lzmaData);
  const score = await new ScoreDecoder().decodeFromBuffer(scoreBuffer, true);
  console.log(score);
  //const beatmap = await readBeatmap(`${fixtureDir}/beatmap.osu`);

});
