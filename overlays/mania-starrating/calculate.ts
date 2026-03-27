import { get, set } from 'idb-keyval';
import { wrap } from 'comlink';
import type { SRWorkerApi, StarRatingsResult } from './sr-types';

export type { SRMods } from './sr-types';

const rosuWorker = wrap<SRWorkerApi>(
  new Worker(new URL('./rosu.worker.ts', import.meta.url), { type: 'module' })
);

const xxyWorker = wrap<SRWorkerApi>(
  new Worker(new URL('./xxy.worker.ts', import.meta.url), { type: 'module' })
);

export const calculateSR = async (beatmapContent: string) => rosuWorker.calculate(beatmapContent);

export const calculateXXYSR = async (beatmapContent: string) => xxyWorker.calculate(beatmapContent);

export const getStarRatingsWithCache = async (beatmapContent: string, cacheKey: string | null) => {
  if (cacheKey) {
    const cached = await get<StarRatingsResult>(`${cacheKey}`);
    if (cached) {
      console.log(`Cache hit ${cacheKey}`);
      return cached;
    }
  }
  const startTime = performance.now();
  const [sr, xxy] = await Promise.all([
    calculateSR(beatmapContent),
    calculateXXYSR(beatmapContent)
  ]);
  const result = { sr, xxy };
  console.log(`Calculated SR in ${(performance.now() - startTime).toFixed(2)} ms`);
  if (cacheKey) {
    await set(`${cacheKey}`, result);
    console.log(`Cache set ${cacheKey}`);
  }
  return result;
}