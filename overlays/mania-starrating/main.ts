import WebSocketManager, {type WEBSOCKET_V2} from '@/lib/socket';
import { getStarRatingsWithCache } from './calculate';
import { maniaSr } from '../../shared/local-client/index';
import type { ManiaSRData } from '../../shared/local-client/mania-sr';
import chroma from 'chroma-js';

let maniaSRData: Record<string, ManiaSRData> | null = null;
let initPromise: Promise<void> | null = null;
let lastRender: { beatmapContent: string; md5: string } | null = null;

const ensureManiaSRData = () => {
  if (maniaSRData || initPromise) return;
  initPromise = maniaSr.getManiaSRData().then(data => {
    maniaSRData = data;
    console.log(`[mania-starrating] mania-sr 已加载，共 ${Object.keys(data).length} 个谱面`);
    // 加载期间已经用本地计算渲染过的谱面要重绘一次，否则这首拿不到 SPM
    if (lastRender) renderTable(lastRender.beatmapContent, lastRender.md5);
  }).catch(e => {
    console.log('[mania-starrating] mania-sr 加载失败（本次使用本地计算，切歌时重试）:', e);
    // 置空以便下次切歌时重试（例如服务端稍后才启动）
    initPromise = null;
  });
};

const cache = {
  checksum: '',
  stateName: '',
  showInResultScreen: false,
};

const scale = chroma.scale(['#faea3f', '#ffffff', '#ff5252']).domain([-5, 10, 25]);
const getColor = (v: number) => scale(v).hex();

/** 从 .osu 内容里读键数（CircleSize），用来判断 SPM 是星级还是等级。 */
const getKeyCount = (beatmapContent: string): number => {
  const match = beatmapContent.match(/^CircleSize\s*:\s*([\d.]+)/m);
  return match ? Number(match[1]) : 0;
};

const renderTable = async (beatmapContent: string, md5: string) => {
  let data: ManiaSRData;
  lastRender = { beatmapContent, md5 };

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

  const spm = data.SPM ?? null;
  // 只有 7K 的 SPM 是星级；4K/6K 都是等级（Lv），和星级不是一个量纲，不能算 Diff
  const keyCount = getKeyCount(beatmapContent);
  const spmIsLevel = keyCount === 4 || keyCount === 6;

  const renderValue = (id: string, v: number) => {
    document.getElementById(id)!.textContent = v > 0 ? v.toFixed(2) : '-';
  };
  renderValue('sr-nm', data.PPY.NM);
  renderValue('sr-ht', data.PPY.HT);
  renderValue('sr-dt', data.PPY.DT);
  renderValue('xxy-nm', data.XXY.NM);
  renderValue('xxy-ht', data.XXY.HT);
  renderValue('xxy-dt', data.XXY.DT);
  if (spm) {
    renderValue('spm-nm', spm.NM);
    renderValue('spm-ht', spm.HT);
    renderValue('spm-dt', spm.DT);
  }

  const renderDiff = (id: string, sr: number, other: number) => {
    const el = document.getElementById(id)!;
    if (sr > 0 && other > 0) {
      const pct = (other - sr) / sr * 100;
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

  // SPM 只有服务端数据包才有：没有 SPM 数据时整行隐藏；4K/6K 是等级，只显示数值不显示 Diff
  document.getElementById('spm-row')!.style.display = spm ? '' : 'none';
  document.getElementById('spm-label')!.textContent = spmIsLevel ? 'SPM Lv' : 'SPM';
  document.getElementById('spm-diff-row')!.style.display = spm && !spmIsLevel ? '' : 'none';
  if (spm && !spmIsLevel) {
    renderDiff('spm-diff-nm', data.PPY.NM, spm.NM);
    renderDiff('spm-diff-ht', data.PPY.HT, spm.HT);
    renderDiff('spm-diff-dt', data.PPY.DT, spm.DT);
  }
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



