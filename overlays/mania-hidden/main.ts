import WebSocketManager from '@/lib/socket';
import { parseBeatmap } from '@/parsers';
import { getSv, type SvPoint } from '../mania-beatmap-stats/charts/nps';

const cache = {
  checksum: '',
  stateName: '',
  width: 800,
  height: 400,
  animationDuration: 1000,
  sv: [] as SvPoint[],
};

const app = document.getElementById('app')!;
const mask = document.getElementById('mask')!;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const updateSize = () => {
  app.style.width = `${cache.width}px`;
  app.style.height = `${cache.height}px`;
};

const updateAnimationDuration = () => {
  mask.style.transitionDuration = `${cache.animationDuration}ms`;
};

const updateOcclusion = (time: number) => {
  if (!cache.sv.length) {
    mask.style.top = '100%';
    return;
  }

  let currentSv = cache.sv[0][1];
  let left = 0;
  let right = cache.sv.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const [pointTime, velocity] = cache.sv[mid];

    if (pointTime <= time + cache.animationDuration / 2) {
      currentSv = velocity;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  const ratio = currentSv >= 1 ? 1 : clamp(currentSv, 0, 1);
  mask.style.top = `${(1 - ratio) * 100}%`;
};

updateSize();
updateAnimationDuration();

const socket = new WebSocketManager(window.location.host);

socket.sendCommand('getSettings', window.COUNTER_PATH);
socket.commands((data) => {
  try {
    const { command, message } = data;
    if (command === 'getSettings') {
      const width = message.width;
      if (Number.isFinite(width) && cache.width !== width) {
        cache.width = width;
        updateSize();
      }

      const height = message.height;
      if (Number.isFinite(height) && cache.height !== height) {
        cache.height = height;
        updateSize();
      }

      const animationDuration = message.animationDuration;
      if (Number.isFinite(animationDuration) && cache.animationDuration !== animationDuration) {
        cache.animationDuration = animationDuration;
        updateAnimationDuration();
      }
    }
  } catch (error) {
    console.log(error);
  };
});

socket.api_v2(async (data) => {
  try {
    if (cache.stateName !== data.state.name) {
      cache.stateName = data.state.name;
      app.style.opacity = cache.stateName === 'play' ? '1' : '0';
    }
    if (cache.checksum !== data.beatmap.checksum && data.state.number === 5) {
      cache.checksum = data.beatmap.checksum;

      const text = await socket.getBeatmapOsuFile('file');
      if (typeof text === 'string') {
        const beatmap = parseBeatmap(text);
        cache.sv = getSv(beatmap);
        console.log(cache.sv);
      }
    }
  } catch (error) {
    console.log(error);
  };
}, []);

socket.api_v2_precise((data) => {
  try {
    updateOcclusion(data.currentTime);
  } catch (error) {
    console.log(error);
  };
}, []);