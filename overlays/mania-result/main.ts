import WebSocketManager, { type WEBSOCKET_V2 } from '@/lib/socket';
import { get, set } from 'idb-keyval';
import { v1, beatmapToNoteColumns, replayToActionColumns } from 'mania-judge';
import { parseBeatmap, parseReplay, applyLegacyBeatmapMods } from 'osu-mania-io';
import { StatusPanel } from '@/status-panel';
import { updateTimeline } from './charts';
import { stable, lazer, osuApiV2 } from '@/local-client';

const cache = {
  beatmapHash: '',
  resultTime: '',
  stateName: '',
  settings: {
    serverUrl: 'http://localhost:5048',
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

socket.api_v2(async (data: WEBSOCKET_V2) => {
  try {
    if (cache.stateName !== data.state.name) {
      cache.stateName = data.state.name;
      app.style.opacity = cache.stateName === 'resultScreen' ? '1' : '0';
      if (cache.stateName !== 'resultScreen') {
        clearStatus();
      }
    }
    
    if (cache.beatmapHash === data.beatmap.checksum &&
        cache.resultTime === data.resultsScreen.createdAt ||
        data.state.name !== 'resultScreen') return;
    
    cache.beatmapHash = data.beatmap.checksum;
    cache.resultTime = data.resultsScreen.createdAt;
    console.log(data);
      
    const beatmapContent = await socket.getBeatmapOsuFile('file');
    if (typeof beatmapContent !== 'string') {
      showError('Failed to load beatmap content.');
      return;
    }

    const scoreBuffer = await getReplayData(data);
    const beatmap = parseBeatmap(beatmapContent);
    const keyCount = beatmap.difficulty.keyCount;
    const replay = parseReplay(new Uint8Array(scoreBuffer), keyCount);
    const effective = replay.mods !== 0 ? applyLegacyBeatmapMods(beatmap, replay.mods) : beatmap;
    const osuData = {
      od: effective.difficulty.overallDifficulty,
      hp: effective.difficulty.hpDrainRate,
      speedRate: 'speedMultiplier' in effective ? (effective as any).speedMultiplier : 1,
      windowScale: 'hitWindowScale' in effective ? (effective as any).hitWindowScale : 1,
      noteColumns: beatmapToNoteColumns(effective),
      actionColumns: replayToActionColumns(replay.frames, keyCount),
    };
    clearStatus();
    const judgements = v1.playOsu(osuData);
    updateTimeline(judgements, cache.settings.windowMs, cache.settings.gapMs, cache.settings.stepMs);
  } catch (error) {
    showError(error);
    console.log(error);
  };
}, []);

async function getReplayData(data: WEBSOCKET_V2) {
  try {
    if (data.client === 'stable') {

      return await stable.getReplayFileWildcard(data.beatmap.checksum, new Date(data.resultsScreen.createdAt));
    } else {
      const beatmapHash = data.files.beatmap.slice(5); // remove folder
      return await lazer.getReplayFile(beatmapHash, new Date(data.resultsScreen.createdAt));
    }
  } catch (error) {
    if (data.resultsScreen.scoreId > 0) {
      const cacheKey = `replay-${data.resultsScreen.scoreId}`;
      let osrData = await get(cacheKey);
      if (!osrData) {
        showLoading('Downloading replay from osu! API v2...');
        const mode = data.client === 'stable' ? data.resultsScreen.mode.name : undefined;
        osrData = await osuApiV2.downloadReplay(data.resultsScreen.scoreId, mode);
        await set(cacheKey, osrData);
        console.log('Replay data fetched from osu! API v2 and stored in IndexedDB');
      }
      return osrData;
    }
    throw new Error('Replay file not found locally and score ID is not available to fetch from osu! API');
  }
}