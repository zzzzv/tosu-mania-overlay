import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TitleComponent } from 'echarts/components';

echarts.use([BarChart, LineChart, GridComponent, CanvasRenderer, TitleComponent]);

echarts.registerTheme('mania', {
  backgroundColor: 'transparent',
  textStyle: { color: '#ffffff' },
  color: ['#79F2E7', '#FFD166', '#6EA8FE'],
  title: { textStyle: { color: '#ffffff' } },
  tooltip: { backgroundColor: 'rgba(0,0,0,0.6)', textStyle: { color: '#ffffff' } },
  categoryAxis: {
    axisLine: { lineStyle: { color: 'rgba(255,255,255,0.6)' } },
    axisLabel: { color: '#ffffff' },
    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }
  },
  valueAxis: {
    axisLine: { lineStyle: { color: 'rgba(255,255,255,0.6)' } },
    axisLabel: { color: '#ffffff' },
    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }
  }
});

export { update as updateHist } from './hist';
export { update as updateNps } from './nps';