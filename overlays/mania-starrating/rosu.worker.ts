import { expose } from 'comlink';
import { calculateRosuSR } from './rosu-sr';
import type { SRWorkerApi } from './sr-types';

const api: SRWorkerApi = {
  calculate: calculateRosuSR,
};

expose(api);