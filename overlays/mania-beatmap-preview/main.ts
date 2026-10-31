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

// 浏览器 canvas 单边上限是 65535px，超过后 canvas 会静默变成 0 尺寸（画什么都是空白）
const MAX_CONTENT_HEIGHT = 60000;
// mania-image 默认的时间轴比例：1px = 10ms
const DEFAULT_SCALE = 0.1;

const app = document.getElementById('app')!;

let renderToken = 0;
let imageUrl = '';

const changeVisibility = () => {
  const visible = cache.stateName === 'selectPlay';
  app.style.opacity = visible ? '1' : '0';
}

const showImage = (blob: Blob) => {
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = URL.createObjectURL(blob);
  app.innerHTML = `<img src="${imageUrl}" />`;
}

const renderImage = async () => {
  const token = ++renderToken;
  const cacheKey = `img:${cache.width}x${cache.height}:${cache.checksum}`;

  const cached = await lruGet<Blob>(cacheKey);
  if (cached) {
    if (token !== renderToken) return;
    console.log(`Cache hit ${cacheKey}`);
    showImage(cached);
    return;
  }
  const startTime = performance.now();
  const beatmapContent = await socket.getBeatmapOsuFile('file');
  if (typeof beatmapContent !== 'string') {
    console.log(`Failed to get beatmap file: ${beatmapContent}`);
    return;
  }
  const mania = parseBeatmap(beatmapContent);
  if (mania.hitObjects.length === 0) {
    console.log('Beatmap has no hit objects');
    return;
  }

  // 与 mania-image 内部一致：startTime = min(首个 note, 0)，endTime = max(最后一个 note 的结束时间)
  let firstTime = 0;
  let lastTime = -Infinity;
  for (const obj of mania.hitObjects) {
    if (obj.startTime < firstTime) firstTime = obj.startTime;
    const end = obj.endTime ?? obj.startTime;
    if (end > lastTime) lastTime = end;
  }
  const duration = Math.max(lastTime - firstTime, 1);
  // 长图（>10min）会把内部画布撑过浏览器上限，等比缩小时间轴，layout 会重新缩放到目标尺寸
  const scale = Math.min(DEFAULT_SCALE, MAX_CONTENT_HEIGHT / duration);

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
    time: { scale },
  });

  const durationMs = performance.now() - startTime;
  console.log(`Rendered image in ${durationMs.toFixed(2)} ms`);

  if (token !== renderToken) return;
  showImage(blob);

  if (durationMs > 300) {
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



