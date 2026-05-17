import WebSocketManager from '@/lib/socket';
import { get, set } from 'idb-keyval';
import { osuApi } from '@/osu-api';
import { v1 } from 'mania-judge';
import { parse } from 'mania-judge/osu-parsers';
import { updateTimeline } from './charts';

const cache = {
  checksum: '',
  scoreId: -1,
  stateName: '',
  isAuthenticated: false,
};

const app = document.getElementById('app')!;
const statusPanel = document.getElementById('status-panel')!;

function showBanner(message: string, state: 'error' | 'loading') {
  statusPanel.textContent = message;
  statusPanel.classList.add('is-visible');
  statusPanel.classList.toggle('is-loading', state === 'loading');
  statusPanel.classList.toggle('is-error', state === 'error');
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
  showBanner(message, 'loading');
}

function clearStatus() {
  statusPanel.textContent = '';
  statusPanel.classList.remove('is-visible');
  statusPanel.classList.remove('is-loading');
  statusPanel.classList.remove('is-error');
  app.style.opacity = cache.stateName === 'resultScreen' ? '1' : '0';
}

const socket = new WebSocketManager(window.location.host);

socket.sendCommand('getSettings', window.COUNTER_PATH);
socket.commands((data) => {
  try {
    const { command, message } = data;
    if (command === 'getSettings') {
      if (!cache.isAuthenticated) {
        const { clientID, clientSecret } = message;

        if (clientID && clientSecret) {
          osuApi.auth(clientID, clientSecret)
            .then(() => {
              cache.isAuthenticated = true;
              clearStatus();
            })
            .catch((error) => {
              showError(error);
              console.log(error);
            });
        } else {
          showError('Client ID or Client Secret not provided in settings.');
          console.log('Client ID or Client Secret not provided in settings.');
        }
      }
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

    if (!cache.isAuthenticated) {
      return;
    }
    
    if (cache.checksum !== data.beatmap.checksum &&
        cache.scoreId !== data.resultsScreen.scoreId &&
        data.state.name === 'resultScreen') {
      cache.checksum = data.beatmap.checksum;
      cache.scoreId = data.resultsScreen.scoreId;
      console.log(data);
      
      const beatmapContent = await socket.getBeatmapOsuFile('file');
      if (typeof beatmapContent === 'string') {
        const cacheKey = `replay-${data.resultsScreen.scoreId}`;
        let replayBuffer = await get(cacheKey);
        if (!replayBuffer) {
          showLoading('Downloading replay from osu! API...');
          replayBuffer = await osuApi.getScore('mania', data.resultsScreen.scoreId);
          await set(cacheKey, replayBuffer);
          console.log('Replay data fetched from osu! API and stored in IndexedDB');
        } else {
          showLoading('Loading replay from IndexedDB...');
          console.log('Replay data fetched from IndexedDB');
        }
        showLoading('Parsing replay data...');
        const { osuData } = await parse(beatmapContent, replayBuffer);
        clearStatus();
        const judgements = v1.playOsu(osuData);
        updateTimeline(judgements, 10000, 6000, 1000);
      }
    }
  } catch (error) {
    showError(error);
    console.log(error);
  };
}, []);