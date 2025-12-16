import WebSocketManager, {type WEBSOCKET_V2} from '@/lib/socket';
import { render } from 'mania-svg';
import { parseBeatmap } from '@/parsers';
import { Hold } from 'osu-mania-stable';

const cache = {
  checksum: '',
  stateName: '',
  width: 800,
  height: 600,
};

const app = document.getElementById('app')!;

const changeVisibility = () => {
  const visible = cache.stateName === 'selectPlay';
  app.style.opacity = visible ? '1' : '0';
}

const renderSVG = async () => {
  const beatmapContent = await socket.getBeatmapOsuFile('file');
  if (typeof beatmapContent !== 'string') {
    console.log(`Failed to get beatmap file: ${beatmapContent}`);
    return;
  }
  const mania = parseBeatmap(beatmapContent);
  const data = {
    keys: mania.difficulty.circleSize,
    notes: mania.hitObjects.map(obj => ({
      start: obj.startTime,
      end: obj instanceof Hold ? obj.endTime : undefined,
      column: obj.column,
    })),
    timingPoints: mania.controlPoints.timingPoints.map(tp => ({
      time: tp.startTime,
      bpm: tp.bpm,
      meter: tp.timeSignature,
    })),
  };

  const svg = render(data, {
    strip: {
      mode: 'ratio',
      ratio: cache.width / cache.height,
    },
    layout: {
      finalScale: 1,
      targetSize: [cache.width, cache.height],
    }
  });
  app.innerHTML = svg;
}

const socket = new WebSocketManager(window.location.host);

socket.sendCommand('getSettings', window.COUNTER_PATH);
socket.commands(async (data: any) => {
  try {
    const { command, message } = data;
    if (command === 'getSettings') {
      if (cache.width !== message.width || cache.height !== message.height) {
        cache.width = message.width;
        cache.height = message.height;
        await renderSVG();
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
      await renderSVG();
    }
  } catch (error) {
    console.log(error);
  };
}, []);



