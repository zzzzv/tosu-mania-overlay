import initXxy, { calc_sr } from 'xxysr-wasm';

type ModKey = 'nm' | 'ht' | 'dt';

const clockRates: Record<ModKey, number> = {
  nm: 1,
  ht: 0.75,
  dt: 1.5,
};

let initialized = false;

export const ensureXxyInitialized = async (wasm?: Parameters<typeof initXxy>[0]) => {
  if (!initialized) {
    await initXxy(wasm);
    initialized = true;
  }
};

export const calculateXxySR = async (beatmapContent: string): Promise<Record<ModKey, number>> => {
  await ensureXxyInitialized();

  const result: Record<ModKey, number> = { nm: 0, ht: 0, dt: 0 };

  for (const [key, rate] of Object.entries(clockRates)) {
    try {
      result[key as ModKey] = calc_sr(beatmapContent, rate);
    } catch (error) {
      console.warn(error);
    }
  }

  return result;
};