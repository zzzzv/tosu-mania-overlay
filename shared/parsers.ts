import { applyBeatmapMods, applyLegacyBeatmapMods, parseBeatmap as ioParseBeatmap, parseReplay as ioParseReplay } from 'osu-mania-io';
import type { Beatmap, ModdedBeatmap, Replay } from 'osu-mania-io';

export { type Beatmap, type ModdedBeatmap, type Replay };

export const parseBeatmap = (beatmapContent: string): Beatmap => {
  return ioParseBeatmap(beatmapContent);
}

export const parseReplay = (buffer: ArrayBuffer | Uint8Array, keyCount: number): Replay => {
  return ioParseReplay(buffer, keyCount);
}

/**
 * Apply the mods recorded in a replay to its beatmap.
 *
 * Lazer replays carry the full lazer mod list, while osu!stable replays store a
 * legacy bitmask plus the RD seed. RD needs a seed on both sides, so a missing seed
 * yields a modless snapshot instead of throwing.
 */
export function applyReplayMods(beatmap: Beatmap, replay: Replay): ModdedBeatmap {
  const lazerMods = replay.lazer?.mods;
  if (lazerMods && lazerMods.length > 0) {
    try {
      return applyBeatmapMods(beatmap, lazerMods);
    } catch (error) {
      console.log('[parsers] failed to apply lazer mods, falling back to legacy mods', error);
    }
  }

  try {
    return applyLegacyBeatmapMods(beatmap, replay.mods, { randomSeed: replay.stableRandomSeed });
  } catch (error) {
    console.log('[parsers] failed to apply legacy mods, ignoring them', error);
    return applyBeatmapMods(beatmap, []);
  }
}
