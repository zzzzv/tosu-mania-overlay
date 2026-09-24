import { v1, lazer, HIT_RESULTS } from 'mania-judge';
import type { Action, Columns, HitResultTable, JudgementV1, JudgementV2, OsuData } from 'mania-judge';

/** Judgement system used to evaluate the play. */
export type JudgeMode = 'v1' | 'lazer';

/** Accuracy weights per judgement system (lazer weights 300s as 300/305, v1 as 1/1). */
export const ACC_TABLES: Record<JudgeMode, Readonly<HitResultTable<number>>> = {
  v1: v1.accTable,
  lazer: lazer.accTable,
};

export type DataPoint = [number, number | null];
type StepMetric = [number, number];
type StepWindow = { time: number; judgements: JudgementV1[] };
type ResetCondition = (current: JudgementV1, next: JudgementV1) => boolean;

/** Judge the play with the selected judgement system. */
export function judgeOsu(data: OsuData, mode: JudgeMode) {
  return mode === 'lazer' ? lazer.playOsu(data) : v1.playOsu(data);
}

export function compareJudgements(a: JudgementV1, b: JudgementV1) {
  if (a.exit !== b.exit) return a.exit - b.exit;
  if (a.note.start !== b.note.start) return a.note.start - b.note.start;
  return a.note.column - b.note.column;
}

/**
 * Flatten judgements into the shared chart representation.
 *
 * Lazer judges a hold note as two hits (head and tail) while v1 judges it as one,
 * so lazer holds are expanded into a head and a tail entry. That keeps both the
 * accuracy weight and the early/late offsets in line with the selected system.
 */
export function normalizeJudgements(
  judgements: Columns<JudgementV1> | Columns<JudgementV2>,
  mode: JudgeMode,
): JudgementV1[] {
  return flattenJudgements(judgements, mode).sort(compareJudgements);
}

function flattenJudgements(
  judgements: Columns<JudgementV1> | Columns<JudgementV2>,
  mode: JudgeMode,
): JudgementV1[] {
  return mode === 'lazer'
    ? fromLazer(judgements as Columns<JudgementV2>)
    : (judgements as Columns<JudgementV1>).flat();
}

function fromLazer(judgements: Columns<JudgementV2>): JudgementV1[] {
  const normalized: JudgementV1[] = [];

  for (const column of judgements) {
    for (const judgement of column) {
      if (!lazer.isHoldV2(judgement)) {
        normalized.push(judgement);
        continue;
      }

      const head = judgement.actions[0];
      const tail = judgement.actions[judgement.actions.length - 1];

      normalized.push({
        note: { column: judgement.note.column, start: judgement.note.start },
        enter: judgement.headEnter,
        exit: judgement.headExit,
        action: head,
        result: judgement.headResult,
      });

      normalized.push({
        note: { column: judgement.note.column, start: judgement.note.end },
        enter: judgement.tailEnter,
        exit: judgement.tailExit,
        action: tail,
        result: judgement.tailResult,
      });
    }
  }

  return normalized;
}

/** The judgement systems reported side by side in the summary. */
export const JUDGE_MODES: readonly JudgeMode[] = ['v1', 'lazer'];

export type JudgeSummary = {
  mode: JudgeMode;
  /** Accuracy of the play as judged without any timing shift. */
  accuracy: number;
  /** Offset, in milliseconds, that yields the highest accuracy. */
  bestOffset: number;
  /** Accuracy reached at `bestOffset`. */
  bestAccuracy: number;
};

/** How many offsets in a row may miss the running maximum before a direction is dropped. */
const SEARCH_TOLERANCE = 3;

/** Shifting further than this is pointless: every note would miss anyway. */
const MAX_SEARCH_OFFSET = 500;

/** Accuracy of a whole play, ignoring its timing. */
export function judgementAccuracy(
  judgements: Columns<JudgementV1> | Columns<JudgementV2>,
  mode: JudgeMode,
): number {
  const [sum, count] = accuracyOf(flattenJudgements(judgements, mode), ACC_TABLES[mode]);
  return count > 0 ? sum / count : 0;
}

/** Summarize every judgement system, including the best timing offset of each. */
export function summarize(osuData: OsuData): JudgeSummary[] {
  return JUDGE_MODES.map((mode) => {
    const accuracy = judgementAccuracy(judgeOsu(osuData, mode), mode);
    const best = findBestOffset(osuData, mode, accuracy);

    return { mode, accuracy, bestOffset: best.offset, bestAccuracy: best.accuracy };
  });
}

/**
 * Walk the timing offset in 1ms steps and keep the offset with the highest accuracy.
 *
 * Both directions start from the unshifted play, and a direction is abandoned once
 * `SEARCH_TOLERANCE` offsets in a row fail to beat the running maximum.
 */
function findBestOffset(osuData: OsuData, mode: JudgeMode, baseAccuracy: number) {
  let bestOffset = 0;
  let bestAccuracy = baseAccuracy;

  for (const direction of [1, -1]) {
    let misses = 0;

    for (let step = 1; misses < SEARCH_TOLERANCE && step <= MAX_SEARCH_OFFSET; step++) {
      const offset = direction * step;
      const shifted = { ...osuData, actionColumns: shiftActions(osuData.actionColumns, offset) };
      const accuracy = judgementAccuracy(judgeOsu(shifted, mode), mode);

      if (accuracy > bestAccuracy) {
        bestOffset = offset;
        bestAccuracy = accuracy;
        misses = 0;
      } else {
        misses++;
      }
    }
  }

  return { offset: bestOffset, accuracy: bestAccuracy };
}

function shiftActions(actionColumns: Columns<Action>, offset: number): Columns<Action> {
  return actionColumns.map((actions) => actions.map((action) => ({
    column: action.column,
    press: action.press + offset,
    release: action.release + offset,
  })));
}

function *stepWindows(sorted: JudgementV1[], stepMs: number, windowMs: number) {
  if (sorted.length === 0) return;

  const endTime = sorted[sorted.length - 1].exit || 0;
  let left = 0;
  let right = 0;

  for (let time = stepMs; time < endTime + stepMs; time += stepMs) {
    while (right < sorted.length && sorted[right].exit <= time) {
      right++;
    }
    while (left < right && sorted[left].exit < time - windowMs) {
      left++;
    }
    yield { time, judgements: sorted.slice(left, right) };
  }
}

function stepAccumulate(
  windows: Iterable<StepWindow>,
  onStep: (judgements: JudgementV1[]) => StepMetric,
  resetCondition: ResetCondition = () => false,
) {
  const series: DataPoint[] = [];
  const allWindows = Array.from(windows);

  let count = 0;
  let total = 0;

  for (let index = 0; index < allWindows.length; index++) {
    const { time, judgements } = allWindows[index];

    const [stepValue, stepCount] = onStep(judgements);
    total += stepValue;
    count += stepCount;
    series.push([time, count > 0 ? total / count : null]);

    const nextJudgements = getNextNonEmptyJudgements(allWindows, index + 1);
    if (
      judgements.length > 0 &&
      nextJudgements &&
      resetCondition(judgements[judgements.length - 1], nextJudgements[0])
    ) {
      count = 0;
      total = 0;
    }
  }

  return series;
}

function getNextNonEmptyJudgements(windows: StepWindow[], startIndex: number) {
  for (let index = startIndex; index < windows.length; index++) {
    if (windows[index].judgements.length > 0) {
      return windows[index].judgements;
    }
  }
}

function accuracyOf(judgements: JudgementV1[], accTable: Readonly<HitResultTable<number>>): StepMetric {
  let sum = 0;
  let count = 0;

  for (const judgement of judgements) {
    sum += accTable[judgement.result];
    count++;
  }

  return [sum, count];
}

function accuracyStep(accTable: Readonly<HitResultTable<number>>) {
  return (judgements: JudgementV1[]) => accuracyOf(judgements, accTable);
}

function offsetStep(judgements: JudgementV1[], includeOffset: (offset: number) => boolean): StepMetric {
  let total = 0;
  let count = 0;

  for (const judgement of judgements) {
    if (judgement.result >= HIT_RESULTS.Meh) continue;

    for (const offset of getOffsets(judgement)) {
      if (!includeOffset(offset)) continue;
      total += offset;
      count++;
    }
  }

  return [total, count];
}

function earlyStep(judgements: JudgementV1[]) {
  return offsetStep(judgements, (offset) => offset < 0);
}

function lateStep(judgements: JudgementV1[]) {
  return offsetStep(judgements, (offset) => offset > 0);
}

function meanOffsetStep(judgements: JudgementV1[]) {
  return offsetStep(judgements, () => true);
}

function makeSeriesBuilder(
  sorted: JudgementV1[],
  accTable: Readonly<HitResultTable<number>>,
  stepMs: number,
  windowMs: number,
  resetCondition?: ResetCondition,
) {
  const build = (onStep: (judgements: JudgementV1[]) => StepMetric) => {
    return stepAccumulate(stepWindows(sorted, stepMs, windowMs), onStep, resetCondition);
  };

  return {
    buildAccuracy: () => build(accuracyStep(accTable)),
    buildEarly: () => build(earlyStep),
    buildLate: () => build(lateStep),
    buildMeanOffset: () => build(meanOffsetStep),
  };
}

export function cumulateSeriesBuilder(
  sorted: JudgementV1[],
  accTable: Readonly<HitResultTable<number>>,
  stepMs: number,
) {
  return makeSeriesBuilder(sorted, accTable, stepMs, stepMs);
}

export function windowedSeriesBuilder(
  sorted: JudgementV1[],
  accTable: Readonly<HitResultTable<number>>,
  stepMs: number,
  windowMs: number,
) {
  return makeSeriesBuilder(sorted, accTable, stepMs, windowMs, () => true);
}

export function splitSeriesBuilder(
  sorted: JudgementV1[],
  accTable: Readonly<HitResultTable<number>>,
  stepMs: number,
  gapMs: number,
) {
  if (gapMs < stepMs) {
    throw new Error('gapMs must be greater than or equal to stepMs');
  }

  return makeSeriesBuilder(sorted, accTable, stepMs, stepMs, (current, next) => next.exit - current.exit > gapMs);
}

function getOffsets(judgement: JudgementV1) {
  return v1.isHoldJudgement(judgement)
    ? [
        judgement.actions[0].press - judgement.note.start,
        judgement.actions[judgement.actions.length - 1].release - judgement.note.end,
      ]
    : [judgement.exit - judgement.note.start];
}
