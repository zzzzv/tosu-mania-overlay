import { get, set } from 'idb-keyval';
import initRosu, { Difficulty, Beatmap } from 'rosu-pp-js';
import initXxy, { calc_sr } from 'xxysr-wasm';

export type SRMods = 'nm' | 'ht' | 'dt';

const initialized = { rosu: false, xxy: false };

export const calculateSR = async(beatmapContent: string) => {
  if (!initialized.rosu) {
    await initRosu();
    initialized.rosu = true;
  }

  const beatmap = new Beatmap(beatmapContent);
  const diff = new Difficulty();
  const clockRates: Record<SRMods, number> = { nm: 1, ht: 0.75, dt: 1.5 };
  const result: Record<SRMods, number> = { nm: 0, ht: 0, dt: 0 };

  for (const [key, rate] of Object.entries(clockRates)) {
    diff.clockRate = rate;
    const attrs = diff.calculate(beatmap);
    result[key as SRMods] = attrs.stars;
    attrs.free();
  }
  beatmap.free();
  diff.free();
  return result;
}

export const calculateXXYSR = async (beatmapContent: string) => {
  if (!initialized.xxy) {
    await initXxy();
    initialized.xxy = true;
  }
  
  const clockRates: Record<SRMods, number> = { nm: 1, ht: 0.75, dt: 1.5 };
  const result: Record<SRMods, number> = { nm: 0, ht: 0, dt: 0 };

  for (const [key, rate] of Object.entries(clockRates)) {
    try{
      result[key as SRMods] = calc_sr(beatmapContent, rate);
    } catch (e) {
      console.warn(e);
      result[key as SRMods] = 0;
    }
  }

  return result;
}

export const getStarRatingsWithCache = async (beatmapContent: string, cacheKey: string | null) => {
  if (cacheKey) {
    const cached = await get(`${cacheKey}`);
    if (cached) {
      return cached;
    }
  }
  const [sr, xxy] = await Promise.all([
    calculateSR(beatmapContent),
    calculateXXYSR(beatmapContent)
  ]);
  const result = { sr, xxy };
  if (cacheKey) {
    await set(`${cacheKey}`, result);
  }
  return result;
}