import WebSocketManager from '@/lib/socket';
import { tosuApi } from '@/api';
import { getStarRatingsWithCache, type SRMods } from '@/lib/star-rating';
import chroma from 'chroma-js';

const socket = new WebSocketManager(window.location.host);

const cache = {
    checksum: '',
};

const scale = chroma.scale(['#faea3f', '#ffffff', '#ff5252']).domain([-5, 10, 25]);
const getColor = (v: number) => scale(v).hex();
const mods = ['nm', 'ht', 'dt'] as SRMods[];

export async function renderTable(beatmapContent: string, cacheKey: string | null) {
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

socket.api_v2(async (data: any) => {
  try {
    if (cache.checksum !== data.beatmap.checksum && data.state.number === 5) {
      cache.checksum = data.beatmap.checksum;
      console.log(data);
      
      const text = await tosuApi.getCurrentBeatmap();
      renderTable(text, data.beatmap.checksum);
    }
  } catch (error) {
    console.log(error);
  };
}, []);



