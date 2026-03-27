import { expose } from 'comlink';
import { calculateXxySR } from './xxy-sr';
import type { SRWorkerApi } from './sr-types';

const api: SRWorkerApi = {
  calculate: calculateXxySR,
};

expose(api);