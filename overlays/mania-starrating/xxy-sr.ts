import initXxy, { calc_sr } from 'xxysr-wasm';
import { clockRates, emptySRValues, type SRValues } from './sr-types';

let initialized = false;

export const ensureXxyInitialized = async (wasm?: Parameters<typeof initXxy>[0]) => {
  if (!initialized) {
    await initXxy(wasm);
    initialized = true;
  }
};

export const calculateXxySR = async (beatmapContent: string): Promise<SRValues> => {
  await ensureXxyInitialized();

  const result = emptySRValues();

  for (const [key, rate] of Object.entries(clockRates)) {
    try {
      result[key as keyof SRValues] = calc_sr(beatmapContent, rate);
    } catch (error) {
      console.warn(error);
      result[key as keyof SRValues] = 0;
    }
  }

  return result;
};