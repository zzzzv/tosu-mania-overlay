import type { JudgementV1 } from 'mania-judge'
import { v1, HIT_RESULTS, isHoldJudgement } from 'mania-judge';

export type DataPoint = [number, number | null];
type StepMetric = [number, number];
type StepWindow = { time: number; judgements: JudgementV1[] };
type ResetCondition = (current: JudgementV1, next: JudgementV1) => boolean;

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

function accuracyStep(judgements: JudgementV1[]): StepMetric {
  return [judgements.reduce((sum, judgement) => sum + v1.accTable[judgement.result], 0), judgements.length];
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
  stepMs: number,
  windowMs: number,
  resetCondition?: ResetCondition,
) {
  const build = (onStep: (judgements: JudgementV1[]) => StepMetric) => {
    return stepAccumulate(stepWindows(sorted, stepMs, windowMs), onStep, resetCondition);
  };

  return {
    buildAccuracy: () => build(accuracyStep),
    buildEarly: () => build(earlyStep),
    buildLate: () => build(lateStep),
    buildMeanOffset: () => build(meanOffsetStep),
  };
}

export function cumulateSeriesBuilder(sorted: JudgementV1[], stepMs: number) {
  return makeSeriesBuilder(sorted, stepMs, stepMs);
}

export function windowedSeriesBuilder(sorted: JudgementV1[], stepMs: number, windowMs: number) {
  return makeSeriesBuilder(sorted, stepMs, windowMs, () => true);
}

export function splitSeriesBuilder(sorted: JudgementV1[], stepMs: number, gapMs: number) {
  if (gapMs < stepMs) {
    throw new Error('gapMs must be greater than or equal to stepMs');
  }

  return makeSeriesBuilder(sorted, stepMs, stepMs, (current, next) => next.exit - current.exit > gapMs);
}

function getOffsets(judgement: JudgementV1) {
  return isHoldJudgement(judgement)
    ? [
        judgement.actions[0].press - judgement.note.start,
        judgement.actions[judgement.actions.length - 1].release - judgement.note.end,
      ]
    : [judgement.exit - judgement.note.start];
}
