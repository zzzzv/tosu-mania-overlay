import { get, set, del, keys } from 'idb-keyval';

type Meta = { ts: number; };

const META_PREFIX = '__meta__:';
const MAX_ENTRIES = 200;

async function touch(key: string) {
  const metaKey = META_PREFIX + key;
  await set(metaKey, { ts: Date.now() } satisfies Meta);
}

export async function lruGet<T>(key: string) {
  const val = await get<T>(key);
  if (val !== undefined) await touch(key);
  return val;
}

export async function lruSet<T>(key: string, value: T) {
  await set(key, value);
  await touch(key);
  await evictIfNeeded();
}

async function evictIfNeeded() {
  const allKeys = await keys();
  const dataKeys = allKeys.filter(k => typeof k === 'string' && !k.startsWith(META_PREFIX)) as string[];
  if (dataKeys.length <= MAX_ENTRIES) return;

  const metaList: Array<{ key: string; ts: number }> = [];
  for (const k of dataKeys) {
    const meta = await get<Meta>(META_PREFIX + k);
    metaList.push({ key: k, ts: meta?.ts ?? 0 });
  }
  metaList.sort((a, b) => a.ts - b.ts);
  const toRemove = metaList.slice(0, dataKeys.length - MAX_ENTRIES);
  for (const m of toRemove) {
    await del(m.key);
    await del(META_PREFIX + m.key);
  }
}