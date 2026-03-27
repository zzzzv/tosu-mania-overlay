import initRosu, { Beatmap, Difficulty } from 'rosu-pp-js';
import { clockRates, emptySRValues, type SRValues } from './sr-types';

let initialized = false;

export const ensureRosuInitialized = async (wasm?: Parameters<typeof initRosu>[0]) => {
  if (!initialized) {
    await initRosu(wasm);
    initialized = true;
  }
};

export const calculateRosuSR = async (beatmapContent: string): Promise<SRValues> => {
  await ensureRosuInitialized();

  const beatmap = new Beatmap(beatmapContent);
  const diff = new Difficulty();
  const result = emptySRValues();

  try {
    for (const [key, rate] of Object.entries(clockRates)) {
      diff.clockRate = rate;
      const attrs = diff.calculate(beatmap);
      result[key as keyof SRValues] = attrs.stars;
      attrs.free();
    }

    return result;
  } finally {
    diff.free();
    beatmap.free();
  }
};