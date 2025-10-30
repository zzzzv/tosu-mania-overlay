import * as echarts from 'echarts/core';
import { ManiaBeatmap } from 'osu-mania-stable';

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
        step: 'start',
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

const getNps = (beatmap: ManiaBeatmap, countTail: boolean = false) => {
  const startTime = 0;
  const endTime = Math.max(
    beatmap.notes.at(-1)?.startTime || 0,
    beatmap.holds.reduce((max, h) => Math.max(max, h.endTime), 0)
  );
  const seconds = Math.floor((endTime - startTime) / 1000) + 1;

  const data = Array.from({ length: seconds }, () => ({ note: 0, hold: 0 }));

  for (const note of beatmap.notes) {
    const second = Math.floor(note.startTime / 1000);
    data[second].note++;
  }

  for (const hold of beatmap.holds) {
    data[Math.floor(hold.startTime / 1000)].hold++;
    if (countTail) {
      data[Math.floor(hold.endTime / 1000)].hold++;
    }
  }
  return data
}

export const getSv = (beatmap: ManiaBeatmap) => {
  const endTime = Math.max(
    beatmap.notes.at(-1)?.startTime || 0,
    beatmap.holds.reduce((max, h) => Math.max(max, h.endTime), 0)
  );

  const data: Record<number, number> = {};

  for (const dp of beatmap.controlPoints.difficultyPoints) {
    data[dp.startTime] = dp.sliderVelocity;
  }
  if (!data[0]) data[0] = 1.0;
  data[endTime] = beatmap.controlPoints.difficultyPoints.at(-1)?.sliderVelocity || 1.0;
  return data;
}

export const update = (beatmap: ManiaBeatmap, countTail: boolean = false): void => {
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
        data: Object.entries(sv).map(([time, velocity]) => [
          Number(time),
          mapDensity(velocity)
        ]),
      }
    ],
  });
}