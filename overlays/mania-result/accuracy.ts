import type { JudgementV1, HitResultTable } from 'mania-judge'
import { v1, calcAccuracy } from 'mania-judge';

export type AccuracyPoint = [number, number | null];

export function calcCumulateSeries(sorted: JudgementV1[], stepMs: number) {
  const series: AccuracyPoint[] = [];

  if (sorted.length === 0) {
    return series;
  }

  let endTime = sorted[sorted.length - 1].exit || 0;
  let count = 0;
  let total = 0;

  for (let time = stepMs; time < endTime + stepMs; time += stepMs) {
    while (count < sorted.length && sorted[count].exit <= time) {
      total += v1.accTable[sorted[count].result];
      count++;
    }
    series.push([time, count > 0 ? total / count : null]);
  }

  return series;
}

export function calcWindowedSeries(sorted: JudgementV1[], windowMs: number, stepMs: number) {
  const series: AccuracyPoint[] = [];

  if (sorted.length === 0) {
    return series;
  }

  let endTime = sorted[sorted.length - 1].exit || 0;
  let left = 0;
  let right = 1;
  
  for (let time = stepMs; time < endTime + stepMs; time += stepMs) {
    while (right < sorted.length && sorted[right].exit <= time) {
      right++;
    }
    while (sorted[left].exit < time - windowMs) {
      left++;
    }
    const windowJudgements = sorted.slice(left, right);
    const acc = calcAccuracy(countResults(windowJudgements), v1.accTable);
    series.push([time, windowJudgements.length > 0 ? acc : null]);
  }

  return series;
}

export function calcSplitSeries(sorted: JudgementV1[], gapMs: number, stepMs: number) {
  const series: AccuracyPoint[] = [];

  if (sorted.length === 0) {
    return series;
  }

  let endTime = sorted[sorted.length - 1].exit || 0;
  let index = 0;
  let count = 0;
  let total = 0;

  for (let time = stepMs; time < endTime + stepMs; time += stepMs) {
    while (index < sorted.length && sorted[index].exit <= time) {
      total += v1.accTable[sorted[index].result];
      count++;
      index++;
      if (index < sorted.length && sorted[index].exit - sorted[index - 1].exit > gapMs) {
        count = 0;
        total = 0;
      }
    }
    series.push([time, count > 0 ? total / count : null]);
  }

  return series;
}

export function countResults(judgements: JudgementV1[]): HitResultTable<number> {
  return judgements.reduce((sum, j) => {
    sum[j.result] += 1;
    return sum;
  }, [0, 0, 0, 0, 0, 0] as HitResultTable<number>);
}
