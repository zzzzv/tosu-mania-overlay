import { test } from 'vitest';
import { readFile } from 'fs/promises';
import { calculateSR, calculateXXYSR } from './calculate';
import { initSync as initRosu } from 'rosu-pp-js';
import { initSync as initXxy } from 'xxysr-wasm';
import path from 'path';

const FIXTURE_ROOT = process.env.FIXTURE_DIR;
if (!FIXTURE_ROOT) {
  throw new Error('Missing FIXTURE_DIR environment variable');
}
const fixtureDir = path.join(FIXTURE_ROOT, 'score-635785967');

test('SR', async () => {
  const wasmPath = require.resolve('rosu-pp-js/rosu_pp_js_bg.wasm');
  const wasmBuffer = await readFile(wasmPath);
  initRosu({ module: wasmBuffer });

  const text = await readFile(`${fixtureDir}/beatmap.osu`, 'utf-8');
  const sr = await calculateSR(text);
  console.log(sr);
});

test('XXY SR', async () => {
  const wasmPath = require.resolve('xxysr-wasm/xxysr_wasm_bg.wasm');
  const wasmBuffer = await readFile(wasmPath);
  initXxy({ module: wasmBuffer });

  const text = await readFile(`${fixtureDir}/beatmap.osu`, 'utf-8');
  const sr = await calculateXXYSR(text);
  console.log(sr);
});
