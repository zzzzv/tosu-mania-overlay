import { parseBeatmap as ioParseBeatmap } from 'osu-mania-io';
import { parseReplay as ioParseReplay } from 'osu-mania-io';
import type { Beatmap } from 'osu-mania-io';

export { type Beatmap };

export const parseBeatmap = (beatmapContent: string): Beatmap => {
  return ioParseBeatmap(beatmapContent);
}

export const parseReplay = (buffer: ArrayBuffer | Uint8Array, keyCount: number) => {
  return ioParseReplay(buffer, keyCount);
}
