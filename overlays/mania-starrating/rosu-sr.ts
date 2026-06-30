import initRosu, { Beatmap, Difficulty } from 'rosu-pp-js';

type ModKey = 'nm' | 'ht' | 'dt';

const clockRates: Record<ModKey, number> = {
  nm: 1,
  ht: 0.75,
  dt: 1.5,
};

const emptyResult = (): Record<ModKey, number> => ({ nm: 0, ht: 0, dt: 0 });

let initialized = false;

export const ensureRosuInitialized = async (wasm?: Parameters<typeof initRosu>[0]) => {
  if (!initialized) {
    await initRosu(wasm);
    initialized = true;
  }
};

export const calculateRosuSR = async (beatmapContent: string): Promise<Record<ModKey, number>> => {
  await ensureRosuInitialized();

  const beatmap = new Beatmap(beatmapContent);
  const diff = new Difficulty();
  const result = emptyResult();

  try {
    for (const [key, rate] of Object.entries(clockRates)) {
      diff.clockRate = rate;
      const attrs = diff.calculate(beatmap);
      result[key as ModKey] = attrs.stars;
      attrs.free();
    }

    return result;
  } finally {
    diff.free();
    beatmap.free();
  }
};