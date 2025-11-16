import WebSocketManager, {type WEBSOCKET_V2} from '@/socket';
import { getStarRatingsWithCache, type SRMods } from './calculate';
import chroma from 'chroma-js';

const cache = {
  checksum: '',
  stateName: '',
  showInResultScreen: false,
};

const scale = chroma.scale(['#faea3f', '#ffffff', '#ff5252']).domain([-5, 10, 25]);
const getColor = (v: number) => scale(v).hex();
const mods = ['nm', 'ht', 'dt'] as SRMods[];

const renderTable = async (beatmapContent: string, cacheKey: string | null) => {
  const data = await getStarRatingsWithCache(beatmapContent, cacheKey);
  mods.forEach(m => {
    document.getElementById(`sr-${m}`)!.textContent = data.sr[m].toFixed(2);
  });

  mods.forEach(m => {
    const el = document.getElementById(`xxy-${m}`)!;
    el.textContent = data.xxy[m] > 0 ? data.xxy[m].toFixed(2) : '-';
  });

  mods.forEach(m => {
    const el = document.getElementById(`diff-${m}`)!;
    if (data.sr[m] > 0 && data.xxy[m] > 0) {
      const pct = (data.xxy[m] - data.sr[m]) / data.sr[m] * 100;
      el.textContent = `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
      el.style.color = getColor(pct);
    } else {
      el.textContent = '-';
      el.style.color = '';
    }
  });
}

const app = document.getElementById('app')!;

const changeVisibility = () => {
  const visible = 
    cache.stateName === 'selectPlay' ||
    (cache.stateName === 'resultScreen' && cache.showInResultScreen)
  app.style.opacity = visible ? '1' : '0';
}

const socket = new WebSocketManager(window.location.host);

socket.sendCommand('getSettings', window.COUNTER_PATH);
socket.commands((data: any) => {
  try {
    const { command, message } = data;
    if (command === 'getSettings') {
      if (cache.showInResultScreen !== message.showInResultScreen) {
        cache.showInResultScreen = message.showInResultScreen;
        changeVisibility();
      }
    }
  } catch (error) {
    console.log(error);
  };
});

socket.api_v2(async (data: WEBSOCKET_V2) => {
  try {
    if (cache.stateName !== data.state.name) {
      cache.stateName = data.state.name;
      changeVisibility();
    }
    if (cache.checksum !== data.beatmap.checksum) {
      cache.checksum = data.beatmap.checksum;
      console.log(data);
      const text = await socket.getBeatmapOsuFile('file');
      if (typeof text === 'string') {
        renderTable(text, data.beatmap.checksum);
      }
    }
  } catch (error) {
    console.log(error);
  };
}, []);



