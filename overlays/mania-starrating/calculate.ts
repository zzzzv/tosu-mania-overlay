import { get, set } from 'idb-keyval';
import { wrap } from 'comlink';
import type { StarRating, ManiaSRData } from '../../shared/local-client/mania-sr';

type ModKey = 'nm' | 'ht' | 'dt';
type WorkerResult = Record<ModKey, number>;

interface SRWorkerApi {
  calculate(beatmapContent: string): Promise<WorkerResult>;
}

const rosuWorker = wrap<SRWorkerApi>(
  new Worker(new URL('./rosu.worker.ts', import.meta.url), { type: 'module' })
);

const xxyWorker = wrap<SRWorkerApi>(
  new Worker(new URL('./xxy.worker.ts', import.meta.url), { type: 'module' })
);

const toStarRating = (v: WorkerResult): StarRating => ({
  NM: v.nm, HT: v.ht, DT: v.dt,
});

export const getStarRatingsWithCache = async (beatmapContent: string, cacheKey: string | null): Promise<ManiaSRData> => {
  if (cacheKey) {
    const cached = await get<ManiaSRData>(`${cacheKey}`);
    if (cached) {
      console.log(`[mania-starrating] 缓存命中 ${cacheKey}`);
      return cached;
    }
  }
  const startTime = performance.now();
  const [sr, xxy] = await Promise.all([
    rosuWorker.calculate(beatmapContent),
    xxyWorker.calculate(beatmapContent),
  ]);
  const result: ManiaSRData = {
    PPY: toStarRating(sr),
    XXY: toStarRating(xxy),
  };
  console.log(`[mania-starrating] 本地计算完成 (${(performance.now() - startTime).toFixed(0)}ms)`);
  if (cacheKey) {
    await set(`${cacheKey}`, result);
  }
  return result;
}