import WebSocketManager, { type WEBSOCKET_V2 } from '@/lib/socket';
import { get, set } from 'idb-keyval';
import { beatmapToNoteColumns, replayToActionColumns } from 'mania-judge';
import type { OsuData } from 'mania-judge';
import { parseBeatmap, parseReplay, applyLegacyBeatmapMods } from 'osu-mania-io';
import { StatusPanel } from '@/status-panel';
import { judgeOsu, summarize, type JudgeMode } from './accuracy';
import { updateSummary, updateTimeline } from './charts';
import { stable, lazer, osuApiV2 } from '@/local-client';

const cache = {
  beatmapHash: '',
  resultTime: '',
  stateName: '',
  osuData: null as OsuData | null,
  summaryToken: 0,
  settings: {
    serverUrl: 'http://localhost:5048',
    judgeMode: 'v1' as JudgeMode,
    stepMs: 1000,
    windowMs: 10000,
    gapMs: 6000
  }
};

const app = document.getElementById('app')!;
const statusPanel = new StatusPanel(document.getElementById('status-panel')!);
statusPanel.bindContent(document.getElementById('content')!);

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

function renderTimeline() {
  if (!cache.osuData) return;

  const osuData = cache.osuData;
  const mode = cache.settings.judgeMode;
  const judgements = judgeOsu(osuData, mode);
  updateTimeline(judgements, mode, cache.settings.windowMs, cache.settings.gapMs, cache.settings.stepMs);
  renderSummary(osuData);
}

function renderSummary(osuData: OsuData) {
  // Searching the best offset re-judges the play dozens of times, so let the chart
  // paint first and drop the work if a newer result came in meanwhile.
  const token = ++cache.summaryToken;

  setTimeout(() => {
    if (token !== cache.summaryToken) return;
    updateSummary(summarize(osuData));
  }, 0);
}

function applySettings(values: Partial<typeof cache.settings>) {
  const next = { ...cache.settings, ...values };
  next.judgeMode = next.judgeMode === 'lazer' ? 'lazer' : 'v1';

  const changed = (Object.keys(next) as (keyof typeof next)[])
    .some((key) => next[key] !== cache.settings[key]);

  cache.settings = next;

  if (changed) {
    renderTimeline();
  }
}

const socket = new WebSocketManager(window.location.host);

socket.sendCommand('getSettings', window.COUNTER_PATH);
socket.commands((data) => {
  try {
    const { command, message } = data;
    if (command === 'getSettings') {
      applySettings(message);
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
    cache.osuData = osuData;
    renderTimeline();
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