import type { WEBSOCKET_V2 } from '@/lib/socket';
import { BinaryWriter } from 'osu-binary';
import { ManiaModCombination } from 'osu-mania-stable';

export async function fetchReplayLZMA(key: string, mode: number, scoreId: number) {
  const query = new URLSearchParams({ 
    k: key, 
    m: mode.toString(),
    s: scoreId.toString() 
  });

  const resp = await fetch(`https://osu.ppy.sh/api/get_replay?${query.toString()}`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch replay: ${resp.status} ${resp.statusText}`);
  }
  
  const json = await resp.json();
  return base64ToBytes(json.content);
}

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const LASTEST_VERSION = 20250107;

export function encodeScoreBuffer(data: WEBSOCKET_V2, lzmaData: Uint8Array) {
  const w = new BinaryWriter();
  w.writeByte(data.resultsScreen.mode.number);
  w.writeInt32(LASTEST_VERSION);
  w.writeString(data.beatmap.checksum);
  w.writeString(data.profile.name);
  w.writeString('');
  for (let i = 0; i < 19; i++) {
    w.writeByte(0);
  }
  const mods = new ManiaModCombination(data.resultsScreen.mods.array.map(m => m.acronym).join(''));
  console.log(mods.bitwise);
  w.writeInt32(mods.bitwise);
  w.writeString('');
  w.writeInt64(0n);
  w.writeInt32(lzmaData.length);
  w.writeBytes(lzmaData);
  w.writeInt64(BigInt(data.resultsScreen.scoreId));
  return w.toUint8Array();
}