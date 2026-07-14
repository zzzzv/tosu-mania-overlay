import WebSocketManager, {type WEBSOCKET_V2} from '@/lib/socket';
import { getStarRatingsWithCache } from './calculate';
import { maniaSr } from '../../shared/local-client/index';
import type { ManiaSRData } from '../../shared/local-client/mania-sr';
import chroma from 'chroma-js';

let maniaSRData: Record<string, ManiaSRData> | null = null;
let initPromise: Promise<void> | null = null;

const ensureManiaSRData = () => {
  if (maniaSRData || initPromise) return;
  initPromise = maniaSr.getManiaSRData().then(data => {
    maniaSRData = data;
    console.log(`[mania-starrating] mania-sr 已加载，共 ${Object.keys(data).length} 个谱面`);
  }).catch(e => {
    console.log('[mania-starrating] mania-sr 加载失败（将使用本地计算）:', e);
  });
};

const cache = {
  checksum: '',
  stateName: '',
  showInResultScreen: false,
};

const scale = chroma.scale(['#faea3f', '#ffffff', '#ff5252']).domain([-5, 10, 25]);
const getColor = (v: number) => scale(v).hex();

const renderTable = async (beatmapContent: string, md5: string) => {
  let data: ManiaSRData;

  if (maniaSRData && md5 in maniaSRData) {
    data = maniaSRData[md5];
    console.log(`[mania-starrating] 使用服务端数据 ${md5}`);
  } else if (!maniaSRData) {
    console.log(`[mania-starrating] 服务端数据未加载，本地计算 ${md5}`);
    ensureManiaSRData();
    data = await getStarRatingsWithCache(beatmapContent, `sr-${md5}`);
  } else {
    console.log(`[mania-starrating] 本地计算 ${md5}`);
    data = await getStarRatingsWithCache(beatmapContent, `sr-${md5}`);
  }

  document.getElementById('sr-nm')!.textContent = data.PPY.NM.toFixed(2);
  document.getElementById('sr-ht')!.textContent = data.PPY.HT.toFixed(2);
  document.getElementById('sr-dt')!.textContent = data.PPY.DT.toFixed(2);

  const renderXxy = (id: string, v: number) => {
    document.getElementById(id)!.textContent = v > 0 ? v.toFixed(2) : '-';
  };
  renderXxy('xxy-nm', data.XXY.NM);
  renderXxy('xxy-ht', data.XXY.HT);
  renderXxy('xxy-dt', data.XXY.DT);

  const renderDiff = (id: string, sr: number, xxy: number) => {
    const el = document.getElementById(id)!;
    if (sr > 0 && xxy > 0) {
      const pct = (xxy - sr) / sr * 100;
      el.textContent = `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
      el.style.color = getColor(pct);
    } else {
      el.textContent = '-';
      el.style.color = '';
    }
  };
  renderDiff('diff-nm', data.PPY.NM, data.XXY.NM);
  renderDiff('diff-ht', data.PPY.HT, data.XXY.HT);
  renderDiff('diff-dt', data.PPY.DT, data.XXY.DT);
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
socket.commands((data) => {
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



