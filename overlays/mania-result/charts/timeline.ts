import * as echarts from 'echarts/core';
import type { Columns, JudgementV1 } from 'mania-judge'
import { compareJudgements } from 'mania-judge';
import type { DataPoint } from '../accuracy';
import { cumulateSeriesBuilder, splitSeriesBuilder, windowedSeriesBuilder } from '../accuracy';

let chart: echarts.EChartsType | null = null;

type PanelConfig = {
  name: string;
  top: number | string;
  height?: number | string;
  bottom?: number | string;
};

const SERIES_COLORS = {
  accuracy: '#5FD1FF',
  early: 'rgba(68, 255, 163, 0.24)',
  late: 'rgba(255, 95, 122, 0.24)',
  meanOffset: '#FFD84D',
};

function formatPercentage(value: number | null) {
  if (value === null) {
    return '';
  }

  return `${(value * 100).toFixed(2).replace(/\.0+$|(?<=\.[0-9]*[1-9])0+$/, '')}%`;
}

function formatIntegerPercentageAxisLabel(value: number) {
  const percentage = value * 100;
  if (!Number.isInteger(percentage)) {
    return '';
  }

  return `${percentage}%`;
}

function formatOffsetAxisLabel(value: number) {
  return Number.isInteger(value) ? `${value}ms` : '';
}

function getOffsetAxisLimit(min: number, max: number) {
  const maxAbs = Math.max(Math.abs(min), Math.abs(max));
  return (Number.isFinite(maxAbs) ? maxAbs : 0) + 10;
}

function averageOffsetSeries(earlySeries: DataPoint[], lateSeries: DataPoint[]) {
  return earlySeries.map(([time, early], index) => {
    const late = lateSeries[index]?.[1] ?? null;

    if (early === null && late === null) {
      return [time, null] as DataPoint;
    }

    if (early === null) {
      return [time, late] as DataPoint;
    }

    if (late === null) {
      return [time, early] as DataPoint;
    }

    return [time, (early + late) / 2] as DataPoint;
  });
}

function getSegmentEndMarkers(series: DataPoint[]) {
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
  const panels: PanelConfig[] = [
    { name: 'Cum', top: 30, height: '24%' },
    { name: 'Window', top: '39%', height: '24%' },
    { name: 'Split', top: '68%', bottom: 24 },
  ];

  const axisLabelFormatter = (value: number) => {
    const totalSeconds = Math.floor(value / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  chart.setOption({
    legend: {
      top: 0,
      left: 'center',
      selectedMode: false,
      icon: 'roundRect',
      itemWidth: 16,
      itemHeight: 10,
      textStyle: { color: '#ffffff' },
      data: ['Accuracy', 'Early', 'Late', 'Mean Offset'],
    },
    grid: panels.map((panel) => ({
      left: 56,
      right: 56,
      top: panel.top,
      height: panel.height,
      bottom: panel.bottom,
      outerBoundsMode: 'none'
    })),
    xAxis: panels.map((_, index) => ({
      type: 'value',
      gridIndex: index,
      max: 'dataMax',
      axisLabel: index === panels.length - 1 ? { formatter: axisLabelFormatter } : { show: false, formatter: axisLabelFormatter },
      axisTick: index === panels.length - 1 ? undefined : { show: false },
    })),
    yAxis: panels.flatMap((panel, index) => ([
      {
        type: 'value',
        gridIndex: index,
        min: 'dataMin',
        max: 'dataMax',
        name: panel.name,
        nameLocation: 'center',
        nameGap: 40,
        axisLabel: {
          margin: 4,
          showMaxLabel: false,
          formatter: formatIntegerPercentageAxisLabel,
        }
      },
      {
        type: 'value',
        gridIndex: index,
        position: 'right',
        min: ({ min, max }: { min: number; max: number }) => -getOffsetAxisLimit(min, max),
        max: ({ min, max }: { min: number; max: number }) => getOffsetAxisLimit(min, max),
        axisLabel: {
          margin: 4,
          formatter: formatOffsetAxisLabel,
        },
        splitLine: { show: false },
      }
    ])),
    series: panels.flatMap((_, index) => {
      const xAxisIndex = index;
      const accuracyAxisIndex = index * 2;
      const offsetAxisIndex = accuracyAxisIndex + 1;

      return [
        {
          name: 'Accuracy',
          type: 'line',
          xAxisIndex,
          yAxisIndex: accuracyAxisIndex,
          color: SERIES_COLORS.accuracy,
          data: [],
          showSymbol: false,
          connectNulls: false,
          lineStyle: { width: 2, color: SERIES_COLORS.accuracy },
          markPoint: {
            symbolKeepAspect: true,
            itemStyle: { color: SERIES_COLORS.accuracy },
            label: { color: SERIES_COLORS.accuracy },
            data: [],
          },
        },
        {
          name: 'Early',
          type: 'line',
          xAxisIndex,
          yAxisIndex: offsetAxisIndex,
          color: SERIES_COLORS.early,
          data: [],
          showSymbol: false,
          connectNulls: false,
          lineStyle: { width: 0, opacity: 0 },
          areaStyle: { color: SERIES_COLORS.early, origin: 'auto' },
          z: 1,
        },
        {
          name: 'Late',
          type: 'line',
          xAxisIndex,
          yAxisIndex: offsetAxisIndex,
          color: SERIES_COLORS.late,
          data: [],
          showSymbol: false,
          connectNulls: false,
          lineStyle: { width: 0, opacity: 0 },
          areaStyle: { color: SERIES_COLORS.late, origin: 'auto' },
          z: 1,
        },
        {
          name: 'Mean Offset',
          type: 'line',
          xAxisIndex,
          yAxisIndex: offsetAxisIndex,
          color: SERIES_COLORS.meanOffset,
          data: [],
          showSymbol: false,
          connectNulls: false,
          lineStyle: { width: 1, color: SERIES_COLORS.meanOffset },
          z: 3,
        }
      ];
    })
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
  const cumulate = cumulateSeriesBuilder(sorted, stepMs);
  const windowed = windowedSeriesBuilder(sorted, stepMs, windowMs);
  const split = splitSeriesBuilder(sorted, stepMs, gapMs);

  const groups = [cumulate, windowed, split].flatMap((builder) => {
    const earlySeries = builder.buildEarly();
    const lateSeries = builder.buildLate();

    return [
      { data: builder.buildAccuracy(), markPoint: { data: getSegmentEndMarkers(builder.buildAccuracy()) } },
      { data: earlySeries },
      { data: lateSeries },
      { data: builder.buildMeanOffset?.() ?? averageOffsetSeries(earlySeries, lateSeries) },
    ];
  });

  chart.setOption({
    series: groups
  });
}

