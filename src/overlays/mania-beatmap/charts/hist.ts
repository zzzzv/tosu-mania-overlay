import * as echarts from 'echarts/core';
import { ManiaBeatmap } from 'osu-mania-stable';

let chart: echarts.EChartsType | null = null;

const initChart = () => {
  if (chart) return chart;

  const container = document.getElementById('hist')!;
  chart = echarts.init(container, 'mania');
  chart.setOption({
    grid: {
      left: 4,
      right: 4,
      top: 4,
      bottom: 4,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: [],
      axisLabel: { show: false },
      axisTick: { show: false },
      axisLine: { show: false }
    },
    yAxis: [
      {
        type: 'value',
        axisLabel: { 
          margin: 4,
          showMaxLabel: false,
        }
      }
    ],
    series: [
      {
        data: [],
        type: 'bar',
        stack: 'all',
      },
      {
        data: [],
        type: 'bar',
        stack: 'all',
      }
    ],
  });
  return chart;
};

export const update = (beatmap: ManiaBeatmap, countTail: boolean = false): void => {
  const chart = initChart();

  const keys = beatmap.difficulty!.circleSize;
  const data = Array.from({ length: keys }, () => ({ note: 0, hold: 0 }));

  for (const note of beatmap.notes) {
    data[note.column].note++;
  }

  for (const hold of beatmap.holds) {
    data[hold.column].hold++;
    if (countTail) {
      data[hold.column].hold++;
    }
  }

  chart.setOption({
    xAxis: {
      data: data.map((_, i) => i),
    },
    series: [
      {
        data: data.map(x => x.note),
      },
      {
        data: data.map(x => x.hold),
      }
    ],
  });
};