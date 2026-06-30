import { decode } from '@msgpack/msgpack';
import { config } from './config';

export interface StarRating {
  NM: number;
  HT: number;
  DT: number;
}

export interface ManiaSRData {
  PPY: StarRating;
  XXY: StarRating;
}

export async function getManiaSRData(): Promise<Record<string, ManiaSRData>> {
  const res = await fetch(`${config.baseUrl}/api/management/mania-sr/msgpack`);
  const buffer = await res.arrayBuffer();
  return decode(buffer) as Record<string, ManiaSRData>;
}
