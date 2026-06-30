import { expose } from 'comlink';
import { calculateRosuSR } from './rosu-sr';

interface SRWorkerApi {
  calculate(beatmapContent: string): Promise<Record<'nm' | 'ht' | 'dt', number>>;
}

const api: SRWorkerApi = {
  calculate: calculateRosuSR,
};

expose(api);