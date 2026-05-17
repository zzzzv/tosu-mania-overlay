import * as echarts from 'echarts/core';
import type { Columns, JudgementV1 } from 'mania-judge'
import { compareJudgements } from 'mania-judge';
import type { AccuracyPoint } from '../accuracy';
import { calcCumulateSeries, calcWindowedSeries, calcSplitSeries } from '../accuracy';

let chart: echarts.EChartsType | null = null;

function formatPercentage(value: number | null) {
  if (value === null) {
    return '';
  }

  return `${(value * 100).toFixed(2).replace(/\.0+$|(?<=\.[0-9]*[1-9])0+$/, '')}%`;
}

function getSegmentEndMarkers(series: AccuracyPoint[]) {
  return series.flatMap((point, index) => {
    const [, value] = point;
    if (value === null) {
      return [];
    }

    const nextValue = series[index + 1]?.[1];
    if (nextValue !== undefined && nextValue !== null) {
      return [];
    }

    return [{
      coord: point,
      value,
      symbol: 'circle',
      symbolSize: 6,
      label: {
        show: true,
        position: 'top',
        distance: 6,
        formatter: formatPercentage(value),
      }
    }];
  });
}

function initChart() {
  if (chart) return chart;

  const container = document.getElementById('timeline')!;
  chart = echarts.init(container, 'mania');

  const axisLabelFormatter = (value: number) => {
    const totalSeconds = Math.floor(value / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  chart.setOption({
    grid: [
      {
        left: 56,
        right: 8,
        top: 8,
        height: '26%',
        outerBoundsMode: 'none'
      },
      {
        left: 56,
        right: 8,
        top: '37%',
        height: '26%',
        outerBoundsMode: 'none'
      },
      {
        left: 56,
        right: 8,
        top: '66%',
        bottom: 24,
        outerBoundsMode: 'none'
      }
    ],
    xAxis: [
      {
        type: 'value',
        gridIndex: 0,
        max: 'dataMax',
        axisLabel: { show: false, formatter: axisLabelFormatter },
        axisTick: { show: false },
      },
      {
        type: 'value',
        gridIndex: 1,
        max: 'dataMax',
        axisLabel: { show: false, formatter: axisLabelFormatter },
        axisTick: { show: false },
      },
      {
        type: 'value',
        gridIndex: 2,
        max: 'dataMax',
        axisLabel: { formatter: axisLabelFormatter },
      }
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        min: 'dataMin',
        max: 'dataMax',
        name: 'Cum',
        nameLocation: 'center',
        nameGap: 40,
        axisLabel: {
          margin: 4,
          showMaxLabel: false,
          formatter: formatPercentage,
        }
      },
      {
        type: 'value',
        gridIndex: 1,
        min: 'dataMin',
        max: 'dataMax',
        name: 'Window',
        nameLocation: 'center',
        nameGap: 40,
        axisLabel: {
          margin: 4,
          showMaxLabel: false,
          formatter: formatPercentage,
        }
      },
      {
        type: 'value',
        gridIndex: 2,
        min: 'dataMin',
        max: 'dataMax',
        name: 'Split',
        nameLocation: 'center',
        nameGap: 40,
        axisLabel: {
          margin: 4,
          showMaxLabel: false,
          formatter: formatPercentage,
        }
      }
    ],
    series: [
      {
        name: 'Cumulative Accuracy',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: [],
        showSymbol: false,
        connectNulls: false,
        markPoint: {
          symbolKeepAspect: true,
          data: [],
        },
        lineStyle: { width: 2 },
        areaStyle: {
          opacity: 0.1,
        }
      },
      {
        name: 'Windowed Accuracy',
        type: 'line',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: [],
        showSymbol: false,
        connectNulls: false,
        markPoint: {
          symbolKeepAspect: true,
          data: [],
        },
        lineStyle: { width: 2 },
        areaStyle: {
          opacity: 0.1,
        }
      },
      {
        name: 'Split Accuracy',
        type: 'line',
        xAxisIndex: 2,
        yAxisIndex: 2,
        data: [],
        showSymbol: false,
        connectNulls: false,
        markPoint: {
          symbolKeepAspect: true,
          data: [],
        },
        lineStyle: { width: 2 },
        areaStyle: {
          opacity: 0.1,
        }
      }
    ]
  });

  return chart;
}

export function update(
  judgements: Columns<JudgementV1>,
  windowMs: number,
  gapMs: number,
  stepMs: number,
) {
  const chart = initChart();

  const sorted = judgements.flat().sort((a, b) => compareJudgements(a, b));

  const cumulate = calcCumulateSeries(sorted, stepMs);
  const windowed = calcWindowedSeries(sorted, windowMs, stepMs);
  const split = calcSplitSeries(sorted, gapMs, stepMs);

  chart.setOption({
    series: [
      {
        data: cumulate,
        markPoint: { data: getSegmentEndMarkers(cumulate) }
      },
      {
        data: windowed,
        markPoint: { data: getSegmentEndMarkers(windowed) }
      },
      {
        data: split,
        markPoint: { data: getSegmentEndMarkers(split) }
      }
    ]
  });
}

