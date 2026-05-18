import WebSocketManager from '@/lib/socket';
import { get, set } from 'idb-keyval';
import { fetchReplayLZMA, encodeScoreBuffer } from '@/osu-api';
import { v1 } from 'mania-judge';
import { parse } from 'mania-judge/osu-parsers';
import { StatusPanel } from '@/status-panel';
import { updateTimeline } from './charts';

const cache = {
  scoreId: -1,
  stateName: '',
  settings: {
    apiKey: '',
    stepMs: 1000,
    windowMs: 10000,
    gapMs: 6000
  }
};

const app = document.getElementById('app')!;
const timeline = document.getElementById('timeline')!;
const statusPanel = new StatusPanel(document.getElementById('status-panel')!);
statusPanel.bindContent(timeline);

function showBanner(message: string, type: 'info' | 'error') {
  statusPanel.set(message, type);
  app.style.opacity = '1';
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function showError(error: unknown) {
  showBanner(getErrorMessage(error), 'error');
}

function showLoading(message: string) {
  showBanner(message, 'info');
}

function clearStatus() {
  statusPanel.clear();
  app.style.opacity = cache.stateName === 'resultScreen' ? '1' : '0';
}

const socket = new WebSocketManager(window.location.host);

socket.sendCommand('getSettings', window.COUNTER_PATH);
socket.commands((data) => {
  try {
    const { command, message } = data;
    if (command === 'getSettings') {
      cache.settings = { ...cache.settings, ...message };
    }
  } catch (error) {
    showError(error);
    console.log(error);
  };
});

socket.api_v2(async (data) => {
  try {
    if (cache.stateName !== data.state.name) {
      cache.stateName = data.state.name;
      app.style.opacity = cache.stateName === 'resultScreen' ? '1' : '0';
      if (cache.stateName !== 'resultScreen') {
        clearStatus();
      }
    }

    if (!cache.settings.apiKey) {
      showError('API key is not set. Please set it in the settings.');
      return;
    }
    
    if (cache.scoreId !== data.resultsScreen.scoreId &&
        data.state.name === 'resultScreen') {
      console.log(data);

      if (data.resultsScreen.scoreId > 0) {
        cache.scoreId = data.resultsScreen.scoreId;
      } else {
        showError('No valid score ID found');
        return;
      }
      
      const beatmapContent = await socket.getBeatmapOsuFile('file');
      if (typeof beatmapContent === 'string') {
        const cacheKey = `replay-${data.resultsScreen.scoreId}`;
        let lzmaData = await get(cacheKey);
        if (!lzmaData) {
          showLoading('Downloading replay from osu! API...');
          lzmaData = await fetchReplayLZMA(cache.settings.apiKey, data.resultsScreen.mode.number, data.resultsScreen.scoreId);
          await set(cacheKey, lzmaData);
          console.log('Replay data fetched from osu! API and stored in IndexedDB');
        }
        showLoading('Parsing replay data...');
        const scoreBuffer = encodeScoreBuffer(data, lzmaData);
        const { osuData } = await parse(beatmapContent, scoreBuffer);
        clearStatus();
        const judgements = v1.playOsu(osuData);
        updateTimeline(judgements, cache.settings.windowMs, cache.settings.gapMs, cache.settings.stepMs);
      }
    }
  } catch (error) {
    showError(error);
    console.log(error);
  };
}, []);