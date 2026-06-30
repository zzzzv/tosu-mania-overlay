import { expose } from 'comlink';
import { calculateXxySR } from './xxy-sr';

interface SRWorkerApi {
  calculate(beatmapContent: string): Promise<Record<'nm' | 'ht' | 'dt', number>>;
}

const api: SRWorkerApi = {
  calculate: calculateXxySR,
};

expose(api);