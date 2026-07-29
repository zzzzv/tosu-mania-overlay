import WebSocketManager, {type WEBSOCKET_V2} from '@/lib/socket';
import { render } from 'mania-image';
import { parseBeatmap } from '@/parsers';
import { lruGet, lruSet } from '@/lru-cache';

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

const renderImage = async () => {
  const cacheKey = `img:${cache.width}x${cache.height}:${cache.checksum}`;

  const cached = await lruGet<Blob>(cacheKey);
  if (cached) {
    console.log(`Cache hit ${cacheKey}`);
    const url = URL.createObjectURL(cached);
    app.innerHTML = `<img src="${url}" />`;
    return;
  }
  const startTime = performance.now();
  const beatmapContent = await socket.getBeatmapOsuFile('file');
  if (typeof beatmapContent !== 'string') {
    console.log(`Failed to get beatmap file: ${beatmapContent}`);
    return;
  }
  const mania = parseBeatmap(beatmapContent);
  const data = {
    keys: mania.difficulty.keyCount,
    notes: mania.hitObjects.map(obj => ({
      startTime: obj.startTime,
      endTime: obj.endTime,
      column: obj.column,
    })),
    timingPoints: mania.controlPoints
      .filter((cp): cp is { kind: 'timing'; time: number; beatLength: number; meter: number } => cp.kind === 'timing')
      .map(tp => ({
        time: tp.time,
        beatLength: tp.beatLength,
        meter: tp.meter,
      })),
  };

  const blob = await render(data, {
    layout: { mode: 'size', size: [cache.width, cache.height] },
  });

  const duration = performance.now() - startTime;
  console.log(`Rendered image in ${duration.toFixed(2)} ms`);

  const url = URL.createObjectURL(blob);
  app.innerHTML = `<img src="${url}" />`;

  if (duration > 300) {
    await lruSet(cacheKey, blob);
    console.log(`Cache set ${cacheKey}`);
  }
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
        await renderImage();
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
      await renderImage();
    }
  } catch (error) {
    console.log(error);
  };
}, []);



