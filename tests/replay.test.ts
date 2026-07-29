import { test } from 'vitest';
import { readFile } from 'fs/promises';
import { osuApiV2 } from '@/local-client';
import type { WEBSOCKET_V2 } from '@/lib/socket';
import { parseReplay } from 'osu-mania-io';

const fixtureDir = 'tests/fixtures/score-635785967';

test('api v2', async () => {
  const data: WEBSOCKET_V2 = await readFile(`${fixtureDir}/v2.json`, 'utf-8').then(JSON.parse);

  const replayBuffer = await osuApiV2.downloadReplay(data.resultsScreen.scoreId, data.resultsScreen.mode.name);
  const replay = parseReplay(new Uint8Array(replayBuffer), 7);
  console.log(replay);
});
