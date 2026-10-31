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

type SvEvent = {
  time: number;
  multiplier: number;
  /** 绿线（SV）优先于同一时间点的红线重置 */
  isSv: boolean;
};

export const getSv = (beatmap: Beatmap) => {
  const endTime = getEndTime(beatmap);
  const timingPoints = getTimingPoints(beatmap);
  const svPoints = getSvPoints(beatmap);
  const commonBeatLength = timingPoints[0]?.beatLength ?? 500;

  // 红线（非继承时间点）同时也会写入一个 SV=1 的控制点，所以每根红线都会把 SV 重置为 1；
  // 同一时间点上的绿线优先级更高，会覆盖这次重置。只按绿线递推会把上一段的 SV 带过红线，凭空画出 SV。
  const events: SvEvent[] = [
    ...timingPoints.map((tp): SvEvent => ({ time: tp.time, multiplier: 1, isSv: false })),
    ...svPoints.map((sv): SvEvent => ({ time: sv.time, multiplier: sv.multiplier, isSv: true })),
  ].sort((a, b) => a.time - b.time || Number(a.isSv) - Number(b.isSv));

  const raw: Record<number, number> = {};
  let lastVelocity = 1;
  for (const ev of events) {
    const tp = findLastTimingPoint(timingPoints, ev.time);
    const beatLength = tp?.beatLength ?? commonBeatLength;
    const velocity = (commonBeatLength / beatLength) * ev.multiplier;
    raw[ev.time] = velocity;
    lastVelocity = velocity;
  }

  // 以第一段的速度为基准，匀速谱面就是一条平线（=1），不会因为第一段 BPM/SV 不是默认值而整体抬高
  const times = Object.keys(raw).map(Number).sort((a, b) => a - b);
  const base = raw[times[0]] || 1;

  const data: Record<number, number> = {};
  for (const time of times) data[time] = raw[time] / base;
  if (data[0] === undefined) data[0] = 1;

  // 曲线延伸到谱面结尾，保持当前速度（不要拉回 1，否则会在结尾画出假的 SV）
  const lastTime = times.length ? times[times.length - 1] : 0;
  if (endTime > lastTime) data[endTime] = lastVelocity / base;

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