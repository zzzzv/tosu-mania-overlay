import { applyBeatmapMods, applyLegacyBeatmapMods, parseReplay } from 'osu-mania-io';
import type { Beatmap, ModdedBeatmap, Replay } from 'osu-mania-io';
import { beatmapToNoteColumns, calcAccuracy, replayToActionColumns } from 'mania-judge';
import type { HitResultTable, JudgementV1 } from 'mania-judge';
import { ACC_TABLES, judgeOsu, normalizeJudgements, type JudgeMode } from '../mania-result/accuracy';

/** Cumulative accuracy after every judged note, indexed by judgement time. */
export type AccuracyTimeline = {
  /** Judgement times in ascending order; a judgement counts once `time >= times[index]`. */
  times: Float64Array;
  /** Accuracy after the judgement at the same index. */
  values: Float64Array;
};

export type LadderRun = {
  key: string;
  beatmapHash: string;
  playerName: string;
  playedAt: Date | null;
  timeline: AccuracyTimeline;
  finalAccuracy: number;
};

export type LadderRow = {
  run: LadderRun;
  accuracy: number | null;
  delta: number | null;
  count: number;
};

/** A beatmap time range without any note press. */
export type TimeRange = {
  start: number;
  end: number;
};

/** Gaps shorter than this are not worth showing the overlay for. */
const MIN_IDLE_GAP_MS = 2000;

/** Hide this long before an idle range ends, so the next note is never covered. */
const IDLE_HIDE_BEFORE_END_MS = 500;

/**
 * Idle ranges of a beatmap, sorted by time.
 *
 * Only presses count: LN releases are ignored, so holding a note never extends a
 * busy range.
 */
export function idleRanges(beatmap: Beatmap): TimeRange[] {
  const presses = beatmap.hitObjects
    .map(hitObject => hitObject.startTime)
    .sort((left, right) => left - right);

  const ranges: TimeRange[] = [];
  let previousPress = 0;

  for (const press of presses) {
    if (press - previousPress > MIN_IDLE_GAP_MS) {
      ranges.push({ start: previousPress, end: press });
    }
    previousPress = press;
  }

  return ranges;
}

export function isIdleAt(ranges: TimeRange[], time: number) {
  for (const range of ranges) {
    if (time < range.start) return false;
    if (time < range.end - IDLE_HIDE_BEFORE_END_MS) return true;
  }

  return false;
}

export function buildAccuracyTimeline(
  sorted: JudgementV1[],
  accTable: Readonly<HitResultTable<number>>,
): AccuracyTimeline {
  const times = new Float64Array(sorted.length);
  const values = new Float64Array(sorted.length);
  let sum = 0;

  for (let index = 0; index < sorted.length; index++) {
    sum += accTable[sorted[index].result];
    times[index] = sorted[index].exit;
    values[index] = sum / (index + 1);
  }

  return { times, values };
}

/** Accuracy and number of judged notes at `time`. */
export function sampleTimeline(timeline: AccuracyTimeline, time: number) {
  const { times, values } = timeline;
  let left = 0;
  let right = times.length - 1;
  let found = -1;

  while (left <= right) {
    const middle = (left + right) >> 1;
    if (times[middle] <= time) {
      found = middle;
      left = middle + 1;
    } else {
      right = middle - 1;
    }
  }

  return {
    accuracy: found < 0 ? null : values[found],
    count: found + 1,
  };
}

export function buildRun(
  key: string,
  data: ArrayBuffer,
  beatmap: Beatmap,
  keyCount: number,
  mode: JudgeMode,
): LadderRun {
  const replay = parseReplay(new Uint8Array(data), keyCount);
  const effective = applyReplayMods(beatmap, replay);
  const sorted = normalizeJudgements(judgeOsu({
    od: effective.difficulty.overallDifficulty,
    hp: effective.difficulty.hpDrainRate,
    speedRate: effective.speedMultiplier,
    windowScale: effective.hitWindowScale,
    noteColumns: beatmapToNoteColumns(effective),
    actionColumns: replayToActionColumns(replay.frames, keyCount),
  }, mode), mode);
  const timeline = buildAccuracyTimeline(sorted, ACC_TABLES[mode]);

  const playedAt = replay.playedAt;
  const playedAtTime = playedAt.getTime();
  const validPlayedAt = Number.isFinite(playedAtTime) && playedAt.getFullYear() >= 2007
    ? playedAt
    : null;

  return {
    key,
    beatmapHash: replay.beatmapHash,
    playerName: replay.username || '?',
    playedAt: validPlayedAt,
    timeline,
    finalAccuracy: timeline.values.length > 0 ? timeline.values[timeline.values.length - 1] : 0,
  };
}

function applyReplayMods(beatmap: Beatmap, replay: Replay): ModdedBeatmap {
  const lazerMods = replay.lazer?.mods;
  if (lazerMods && lazerMods.length > 0) {
    try {
      return applyBeatmapMods(beatmap, lazerMods);
    } catch (error) {
      console.log('[mania-ladder] failed to apply lazer mods, falling back to legacy mods', error);
    }
  }

  if (replay.mods !== 0) {
    return applyLegacyBeatmapMods(beatmap, replay.mods);
  }

  return applyBeatmapMods(beatmap, []);
}

/** Accuracy of a hit-result count table; null when nothing has been judged yet. */
export function resultsAccuracy(
  resultCounts: Readonly<HitResultTable<number>>,
  mode: JudgeMode,
): number | null {
  const total = resultCounts.reduce((sum, count) => sum + count, 0);
  return total > 0 ? calcAccuracy(resultCounts, ACC_TABLES[mode]) : null;
}

/** Rows sorted by accuracy at `time`, best first; unjudged runs go last. */
export function rankRuns(runs: LadderRun[], time: number, liveAcc: number | null): LadderRow[] {
  return runs
    .map((run) => {
      const { accuracy, count } = sampleTimeline(run.timeline, time);
      return {
        run,
        accuracy,
        delta: accuracy === null || liveAcc === null ? null : accuracy - liveAcc,
        count,
      };
    })
    .sort((left, right) => {
      if (left.accuracy === null && right.accuracy === null) return byPlayedAt(left, right);
      if (left.accuracy === null) return 1;
      if (right.accuracy === null) return -1;
      if (right.accuracy !== left.accuracy) return right.accuracy - left.accuracy;
      if (right.count !== left.count) return right.count - left.count;
      return byPlayedAt(left, right);
    });
}

function byPlayedAt(left: LadderRow, right: LadderRow) {
  return (right.run.playedAt?.getTime() ?? 0) - (left.run.playedAt?.getTime() ?? 0);
}
