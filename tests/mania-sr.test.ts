import { encode } from '@msgpack/msgpack';
import { describe, expect, it, vi } from 'vitest';
import { getManiaSRData } from '../shared/local-client/mania-sr';

const stubFetch = (bytes: Uint8Array) => {
  const buffer = bytes.slice().buffer;
  vi.stubGlobal('fetch', async () => ({ ok: true, arrayBuffer: async () => buffer }));
};

describe('mania-sr 数据包格式', () => {
  it('读取 v2 紧凑数组格式', async () => {
    stubFetch(encode({
      a: [1, [5.1, 4.2, 6.3], [5.0, 4.1, 6.2], [4.9, 4.0, 6.1]],
      b: [1, [3.1, 2.2, 3.3], [3.0, 2.1, 3.2]],
      c: [0b110101, [2.0, 1.5, 2.5]],
    }));

    expect(await getManiaSRData()).toEqual({
      a: { PPY: { NM: 5.1, HT: 4.2, DT: 6.3 }, XXY: { NM: 5.0, HT: 4.1, DT: 6.2 }, SPM: { NM: 4.9, HT: 4.0, DT: 6.1 } },
      b: { PPY: { NM: 3.1, HT: 2.2, DT: 3.3 }, XXY: { NM: 3.0, HT: 2.1, DT: 3.2 }, SPM: null },
      c: { PPY: { NM: 2.0, HT: 1.5, DT: 2.5 }, XXY: { NM: 0, HT: 0, DT: 0 }, SPM: null },
    });
  });

  it('读取 v1 字段名格式', async () => {
    stubFetch(encode({
      a: { PPY: { NM: 5.1, HT: 4.2, DT: 6.3 }, XXY: { NM: 5.0, HT: 4.1, DT: 6.2 } },
      d: { PPY: null, XXY: { NM: 0, HT: 0, DT: 0 } },
    }));

    expect(await getManiaSRData()).toEqual({
      a: { PPY: { NM: 5.1, HT: 4.2, DT: 6.3 }, XXY: { NM: 5.0, HT: 4.1, DT: 6.2 }, SPM: null },
      d: { PPY: { NM: 0, HT: 0, DT: 0 }, XXY: { NM: 0, HT: 0, DT: 0 }, SPM: null },
    });
  });
});
