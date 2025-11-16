import WebSocketManager from '@/socket';
import { parseBeatmap } from '@/parsers';
import { updateHist, updateNps } from './charts';

const cache = {
  checksum: '',
  stateName: '',
  showInResultScreen: false,
};

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

socket.api_v2(async (data: any) => {
  try {
    if (cache.stateName !== data.state.name) {
      cache.stateName = data.state.name;
      changeVisibility();
    }
    if (cache.checksum !== data.beatmap.checksum && data.state.number === 5) {
      cache.checksum = data.beatmap.checksum;
      console.log(data);
      
      const text = await socket.getBeatmapOsuFile('file');
      if (typeof text === 'string') {
        const beatmap = parseBeatmap(text);
        updateHist(beatmap);
        updateNps(beatmap);
      }
    }
  } catch (error) {
    console.log(error);
  };
}, []);