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
  /** 仅服务端数据包（含 SPM 算法）才会有值 */
  SPM?: StarRating | null;
}

const ZERO: StarRating = { NM: 0, HT: 0, DT: 0 };

const toNumber = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** v1 包里的星级是 {NM,HT,DT} 对象，v2 包里的星级是定长数组 [NM,HT,DT]。 */
const readRating = (raw: unknown): StarRating | null => {
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    return { NM: toNumber(raw[0]), HT: toNumber(raw[1]), DT: toNumber(raw[2]) };
  }
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<StarRating>;
    if (r.NM === undefined && r.HT === undefined && r.DT === undefined) return null;
    return { NM: toNumber(r.NM), HT: toNumber(r.HT), DT: toNumber(r.DT) };
  }
  return null;
};

/**
 * 单条数据的两种格式：
 * <para>v1：{ PPY, XXY }（字段名入包，没有 SPM）</para>
 * <para>v2：[状态位, PPY, XXY, SPM]（尾部槽位缺省，SPM 可能为空）</para>
 */
const readEntry = (raw: unknown): ManiaSRData => {
  const slot = (index: number, name: string): unknown => {
    if (Array.isArray(raw)) return raw[index];
    if (raw && typeof raw === 'object') return (raw as Record<string, unknown>)[name];
    return undefined;
  };

  return {
    PPY: readRating(slot(1, 'PPY')) ?? ZERO,
    XXY: readRating(slot(2, 'XXY')) ?? ZERO,
    SPM: readRating(slot(3, 'SPM')),
  };
};

export async function getManiaSRData(): Promise<Record<string, ManiaSRData>> {
  const res = await fetch(`${config.baseUrl}/api/management/mania-sr/msgpack`);
  if (!res.ok) throw new Error(`mania-sr 数据包请求失败: ${res.status} ${res.statusText}`);
  const buffer = await res.arrayBuffer();
  const raw = decode(buffer) as Record<string, unknown> | null;

  const data: Record<string, ManiaSRData> = {};
  for (const [md5, entry] of Object.entries(raw ?? {})) {
    data[md5] = readEntry(entry);
  }
  return data;
}
