import { BeatmapDecoder, ScoreDecoder } from 'osu-parsers';
import { ManiaRuleset, ManiaBeatmap, ManiaReplayConverter } from 'osu-mania-stable';

export const parseBeatmap = (text: string): ManiaBeatmap => {
  const decoder = new BeatmapDecoder();
  const beatmap = decoder.decodeFromString(text, { parseStoryboard: false });
  const ruleset = new ManiaRuleset();
  const converted = ruleset.applyToBeatmap(beatmap);
  return converted;
}

export const parseReplay = async (buffer: ArrayBuffer|Uint8Array, beatmap: ManiaBeatmap) => {
  const decoder = new ScoreDecoder();
  const score = await decoder.decodeFromBuffer(buffer, true);
  const converter = new ManiaReplayConverter();
  const converted = converter.convertReplay(score.replay!, beatmap);
  return converted;
}