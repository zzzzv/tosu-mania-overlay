import * as echarts from 'echarts/core';
import type { Beatmap, TimingPoint, ScrollVelocityPoint } from 'osu-mania-io';

let chart: echarts.EChartsType | null = null;

const initChart = () => {
  if (chart) return chart;

  const container = document.getElementById('nps')!;
  chart = echarts.init(container, 'mania');

  chart.setOption({
    grid: [
      {
        left: 20,
        right: 4,
        top: 4,
        bottom: '40%',
        outerBoundsMode: 'none'
      },
      {
        left: 20,
        right: 4,
        top: '60%',
        bottom: 20,
        outerBoundsMode: 'none'
      }
    ],
    xAxis: [
      {
        type: 'category',
        data: [],
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { show: false },
        gridIndex: 0,
      },
      {
        type: 'value',
        data: [],
        axisLabel: {
          formatter: (value: number) => {
            const totalSeconds = Math.floor(value / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
          }
        },
        gridIndex: 1,
      }
    ],
    yAxis: [
      {
        type: 'value',
        axisLabel: {
          margin: 4,
          showMaxLabel: false,
        },
        gridIndex: 0
      },
      {
        type: 'value',
        axisLabel: {
          margin: 4,
          showMaxLabel: false,
          formatter: (value: number) => ({ 0: 'SV', 1: '1' }[value] || '')
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        min: 0,
        max: 2,
        gridIndex: 1
      }
    ],
    series: [
      {
        data: [],
        type: 'bar',
        stack: 'all',
        xAxisIndex: 0,
        yAxisIndex: 0
      },
      {
        data: [],
        type: 'bar',
        stack: 'all',
        xAxisIndex: 0,
        yAxisIndex: 0
      },
      {
        data: [],
        type: 'line',
        step: 'end',
        showSymbol: false,
        lineStyle: {
          color: 'red'
        },
        xAxisIndex: 1,
        yAxisIndex: 1
      }
    ],
  });
  return chart;
};

const getEndTime = (beatmap: Beatmap) => {
  return beatmap.hitObjects.reduce((max, obj) => Math.max(max, obj.endTime ?? obj.startTime), 0);
}

const getTimingPoints = (beatmap: Beatmap): TimingPoint[] => {
  return beatmap.controlPoints.filter((cp): cp is TimingPoint => cp.kind === 'timing');
};

const getSvPoints = (beatmap: Beatmap): ScrollVelocityPoint[] => {
  return beatmap.controlPoints.filter((cp): cp is ScrollVelocityPoint => cp.kind === 'scroll-velocity');
};

const findLastTimingPoint = (timingPoints: TimingPoint[], time: number): TimingPoint | undefined => {
  for (let i = timingPoints.length - 1; i >= 0; i--) {
    if (timingPoints[i].time <= time) return timingPoints[i];
  }
  return undefined;
};

const findLastSvPoint = (svPoints: ScrollVelocityPoint[], time: number): ScrollVelocityPoint | undefined => {
  for (let i = svPoints.length - 1; i >= 0; i--) {
    if (svPoints[i].time <= time) return svPoints[i];
  }
  return undefined;
};

export const getNps = (beatmap: Beatmap, countTail: boolean = false) => {
  const endTime = getEndTime(beatmap);
  const seconds = Math.floor(endTime / 1000) + 1;

  const data = Array.from({ length: seconds }, () => ({ note: 0, hold: 0 }));

  for (const obj of beatmap.hitObjects) {
    const second = Math.floor(obj.startTime / 1000);
    if (obj.endTime === undefined) {
      data[second].note++;
    } else {
      data[second].hold++;
      if (countTail) {
        data[Math.floor(obj.endTime / 1000)].hold++;
      }
    }
  }
  return data
}

export type SvPoint = [time: number, velocity: number];

export const getSv = (beatmap: Beatmap) => {
  const endTime = getEndTime(beatmap);
  const timingPoints = getTimingPoints(beatmap);
  const svPoints = getSvPoints(beatmap);
  const commonBeatLength = timingPoints[0]?.beatLength ?? 500;
  const data: Record<number, number> = {};

  for (const tp of timingPoints) {
    const sv = findLastSvPoint(svPoints, tp.time);
    data[tp.time] = (commonBeatLength / tp.beatLength) * (sv?.multiplier ?? 1);
  }

  for (const sv of svPoints) {
    const tp = findLastTimingPoint(timingPoints, sv.time);
    if (tp) {
      data[sv.time] = (commonBeatLength / tp.beatLength) * sv.multiplier;
    }
  }
  if (!data[0]) data[0] = 1.0;
  data[endTime] = 1.0;
  
  const sorted: SvPoint[] = Object.entries(data)
    .map(([time, velocity]): SvPoint => [Number(time), velocity])
    .sort((a, b) => a[0] - b[0]);
  return sorted;
}

export const update = (beatmap: Beatmap, countTail: boolean = false): void => {
  const chart = initChart();

  const nps = getNps(beatmap, countTail);
  const sv = getSv(beatmap);

  const mapDensity = (value: number): number => {
    if (value <= 1) return value;
    return 1 + (2 / Math.PI) * Math.atan((value - 1) * (Math.PI / 2));
  };
  chart.setOption({
    xAxis: [
      {
        data: nps.map((_, i) => i),
      },
      {
        min: 0,
        max: nps.length * 1000,
      }
    ],
    series: [
      {
        data: nps.map(x => x.note),
      },
      {
        data: nps.map(x => x.hold),
      },
      {
        data: sv.map(([time, velocity]) => [
          time,
          mapDensity(velocity)
        ]),
      }
    ],
  });
}