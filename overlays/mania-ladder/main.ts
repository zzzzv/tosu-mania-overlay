import WebSocketManager, { type WEBSOCKET_V2 } from '@/lib/socket';
import { parseBeatmap } from '@/parsers';
import { StatusPanel } from '@/status-panel';
import { config } from '@/local-client/config';
import type { Beatmap } from 'osu-mania-io';
import type { HitResultTable } from 'mania-judge';
import type { JudgeMode } from '../mania-result/accuracy';
import {
  buildRun,
  idleRanges,
  isIdleAt,
  rankRuns,
  resultsAccuracy,
  type DeltaDirection,
  type LadderRun,
  type TimeRange,
} from './ladder';
import { listLocalReplays, type ReplayRef } from './replays';

type JudgeModeSetting = 'auto' | JudgeMode;

const RENDER_INTERVAL_MS = 100;
const RUN_CACHE_LIMIT = 200;
const LOAD_LIMIT = 100;

const cache = {
  stateName: '',
  client: 'stable' as 'stable' | 'lazer',
  playable: false,
  paused: false,
  liveTime: 0,
  liveAccuracy: null as number | null,
  loadedKey: '',
  loadingKey: '',
  errorKey: '',
  reload: false,
  loadToken: 0,
  runs: [] as LadderRun[],
  idleRanges: [] as TimeRange[],
  rowElements: new Map<string, HTMLElement>(),
  settings: {
    serverUrl: 'http://localhost:5048',
    judgeMode: 'auto' as JudgeModeSetting,
    maxReplays: 15,
    idleOnly: false,
    deltaDirection: 'liveVsReplay' as DeltaDirection,
  },
};

const runCache = new Map<string, LadderRun>();

const app = document.getElementById('app')!;
const content = document.getElementById('content')!;
const rowsContainer = document.getElementById('rows')!;
const liveLabel = document.getElementById('live')!;
const statusPanel = new StatusPanel(document.getElementById('status-panel')!);
statusPanel.bindContent(content);

let visible = false;
let renderTimer = 0;
let lastRender = 0;

const yieldToUI = () => new Promise<void>(resolve => window.setTimeout(resolve, 0));

function setVisible(next: boolean) {
  if (visible === next) return;
  visible = next;
  app.style.opacity = next ? '1' : '0';
  if (!next) {
    statusPanel.clear();
  }
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function resolveJudgeMode(): JudgeMode {
  if (cache.settings.judgeMode === 'auto') {
    return cache.client === 'lazer' ? 'lazer' : 'v1';
  }

  return cache.settings.judgeMode;
}

function currentLiveAccuracy(data: WEBSOCKET_V2): number | null {
  const hits = data.play?.hits;
  if (!hits) return null;

  // socket.js mistypes the numeric hit keys, so index the runtime shape directly.
  const counts = hits as unknown as Record<string, number | undefined>;
  const resultCounts: HitResultTable<number> = [
    counts.geki ?? 0,
    counts['300'] ?? 0,
    counts.katu ?? 0,
    counts['100'] ?? 0,
    counts['50'] ?? 0,
    counts['0'] ?? 0,
  ];
  return resultsAccuracy(resultCounts, resolveJudgeMode());
}

/** The bundled v2 typedef has no `game` field, but tosu reports it. */
function isPaused(data: WEBSOCKET_V2) {
  const game = (data as { game?: { paused?: boolean } }).game;
  return game?.paused === true;
}

/** Whether the idle-only setting lets the overlay show right now. */
function idleGateOpen() {
  return !cache.settings.idleOnly || cache.paused || isIdleAt(cache.idleRanges, cache.liveTime);
}

function refreshVisibility() {
  setVisible(cache.playable && idleGateOpen());
}

function formatAccuracy(value: number | null) {
  return value === null ? '--' : `${(value * 100).toFixed(2)}%`;
}

function formatDelta(value: number | null) {
  if (value === null) return '--';

  const percentage = value * 100;
  if (Math.abs(percentage) < 0.005) return '0.00%';

  return `${percentage > 0 ? '+' : ''}${percentage.toFixed(2)}%`;
}

function deltaClass(value: number | null) {
  if (value === null || Math.abs(value * 100) < 0.005) return '';
  return value > 0 ? 'pos' : 'neg';
}

function formatPlayedAt(date: Date | null) {
  if (!date) return '--';

  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

function createCell(className: string) {
  const cell = document.createElement('span');
  cell.className = className;
  return cell;
}

function clearRows() {
  cache.runs = [];
  cache.rowElements.clear();
  rowsContainer.replaceChildren();
  liveLabel.textContent = '';
}

function buildRows() {
  cache.rowElements.clear();
  const elements = cache.runs.map((run) => {
    const element = document.createElement('div');
    element.className = 'row';

    const rank = createCell('rank');
    const name = createCell('name');
    name.textContent = run.playerName;
    name.title = run.playerName;
    const time = createCell('date');
    time.textContent = formatPlayedAt(run.playedAt);
    const accuracy = createCell('acc');
    const delta = createCell('delta');

    element.append(rank, name, time, accuracy, delta);
    cache.rowElements.set(run.key, element);
    return element;
  });

  rowsContainer.replaceChildren(...elements);
}

function render() {
  if (!visible) return;

  liveLabel.textContent = `Live ${formatAccuracy(cache.liveAccuracy)}`;
  if (cache.runs.length === 0) return;

  const rows = rankRuns(cache.runs, cache.liveTime, cache.liveAccuracy, cache.settings.deltaDirection);
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const element = cache.rowElements.get(row.run.key);
    if (!element) continue;

    element.style.display = index < cache.settings.maxReplays ? '' : 'none';

    const cells = element.children;
    (cells[0] as HTMLElement).textContent = String(index + 1);
    (cells[3] as HTMLElement).textContent = formatAccuracy(row.accuracy);

    const deltaCell = cells[4] as HTMLElement;
    deltaCell.textContent = formatDelta(row.delta);
    deltaCell.className = `delta ${deltaClass(row.delta)}`.trim();

    rowsContainer.appendChild(element);
  }
}

function scheduleRender() {
  if (!visible) return;

  const wait = RENDER_INTERVAL_MS - (performance.now() - lastRender);
  if (wait <= 0) {
    lastRender = performance.now();
    render();
    return;
  }

  if (renderTimer) return;
  renderTimer = window.setTimeout(() => {
    renderTimer = 0;
    lastRender = performance.now();
    render();
  }, wait);
}

async function loadRun(
  ref: ReplayRef,
  beatmap: Beatmap,
  keyCount: number,
  mode: JudgeMode,
  beatmapHash: string,
  lazerBeatmapHash: string,
) {
  const cacheKey = `${mode}:${ref.key}`;
  const cached = runCache.get(cacheKey);
  if (cached) {
    if (ref.playerName && cached.playerName === '?') {
      cached.playerName = ref.playerName;
    }
    return cached;
  }

  try {
    const run = buildRun(ref.key, await ref.load(), beatmap, keyCount, mode);
    if (run.beatmapHash && run.beatmapHash !== beatmapHash && run.beatmapHash !== lazerBeatmapHash) {
      console.log(`[mania-ladder] ignoring ${ref.key}: replay belongs to ${run.beatmapHash}`);
      return null;
    }

    if (ref.playerName && run.playerName === '?') {
      run.playerName = ref.playerName;
    }

    runCache.set(cacheKey, run);
    if (runCache.size > RUN_CACHE_LIMIT) {
      const oldest = runCache.keys().next().value;
      if (oldest !== undefined) runCache.delete(oldest);
    }

    return run;
  } catch (error) {
    console.log(`[mania-ladder] failed to load ${ref.key}`, error);
    return null;
  }
}

async function ensureLoaded(beatmapHash: string, lazerBeatmapHash: string) {
  const mode = resolveJudgeMode();
  const clientHash = cache.client === 'lazer' ? lazerBeatmapHash : '';
  const key = `${cache.client}|${beatmapHash}|${clientHash}|${mode}`;
  if (!cache.reload && (cache.loadedKey === key || cache.loadingKey === key || cache.errorKey === key)) {
    return;
  }

  cache.reload = false;
  const token = ++cache.loadToken;
  cache.loadingKey = key;

  if (!cache.loadedKey.startsWith(`${cache.client}|${beatmapHash}|`)) {
    clearRows();
    cache.idleRanges = [];
  }

  statusPanel.info('正在读取本地 replay…');

  try {
    const beatmapContent = await socket.getBeatmapOsuFile('file');
    if (typeof beatmapContent !== 'string') {
      throw new Error('读取当前谱面失败');
    }
    if (token !== cache.loadToken) return;

    const beatmap = parseBeatmap(beatmapContent);
    cache.idleRanges = idleRanges(beatmap);

    const keyCount = beatmap.difficulty.keyCount;
    const refs = await listLocalReplays(cache.client, beatmapHash, lazerBeatmapHash, LOAD_LIMIT);
    if (token !== cache.loadToken) return;

    if (refs.length === 0) {
      cache.loadedKey = key;
      cache.errorKey = '';
      statusPanel.info('没有找到本地 replay');
      return;
    }

    const runs: LadderRun[] = [];
    for (let index = 0; index < refs.length; index++) {
      if (token !== cache.loadToken) return;

      const run = await loadRun(refs[index], beatmap, keyCount, mode, beatmapHash, lazerBeatmapHash);
      if (run) runs.push(run);
      if (token !== cache.loadToken) return;

      statusPanel.info(`正在计算 replay ${index + 1}/${refs.length}…`);
      await yieldToUI();
    }

    if (token !== cache.loadToken) return;
    cache.runs = runs;
    cache.loadedKey = key;
    cache.errorKey = '';

    buildRows();
    lastRender = performance.now();

    if (runs.length === 0) {
      statusPanel.info('没有可用的本地 replay');
    } else {
      statusPanel.clear();
      render();
    }
  } catch (error) {
    if (token === cache.loadToken) {
      cache.errorKey = key;
      statusPanel.error(formatError(error));
    }
    console.log(error);
  } finally {
    if (cache.loadingKey === key) {
      cache.loadingKey = '';
    }
  }
}

function applySettings(message: Record<string, unknown>) {
  const next = { ...cache.settings };

  if (typeof message.serverUrl === 'string' && message.serverUrl.trim()) {
    next.serverUrl = message.serverUrl.trim().replace(/\/+$/, '');
  }

  if (message.judgeMode === 'auto' || message.judgeMode === 'v1' || message.judgeMode === 'lazer') {
    next.judgeMode = message.judgeMode;
  }

  const maxReplays = Number(message.maxReplays);
  if (Number.isFinite(maxReplays)) {
    next.maxReplays = Math.min(30, Math.max(1, Math.round(maxReplays)));
  }

  if (typeof message.idleOnly === 'boolean') {
    next.idleOnly = message.idleOnly;
  }

  if (message.deltaDirection === 'liveVsReplay' || message.deltaDirection === 'replayVsLive') {
    next.deltaDirection = message.deltaDirection;
  }

  const changed = (Object.keys(next) as (keyof typeof next)[])
    .some(key => next[key] !== cache.settings[key]);
  const serverChanged = next.serverUrl !== cache.settings.serverUrl;
  const modeChanged = next.judgeMode !== cache.settings.judgeMode;
  const idleChanged = next.idleOnly !== cache.settings.idleOnly;

  cache.settings = next;
  config.baseUrl = next.serverUrl;

  if (modeChanged) {
    // The cached judge results use the previous rules; reload from scratch.
    cache.loadedKey = '';
  }

  if (serverChanged) {
    runCache.clear();
    cache.reload = true;
    cache.loadingKey = '';
    cache.errorKey = '';
    cache.loadToken++;
  }

  if (idleChanged) {
    refreshVisibility();
  }

  if (changed) {
    scheduleRender();
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
    console.log(error);
  }
});

socket.api_v2(async (data: WEBSOCKET_V2) => {
  try {
    const previousState = cache.stateName;
    cache.stateName = data.state.name;
    cache.client = data.client;

    if (cache.stateName === 'play' && previousState !== 'play') {
      cache.reload = true;
      cache.errorKey = '';
    }

    const playable = cache.stateName === 'play' && data.beatmap.mode.name === 'mania';
    cache.playable = playable;
    if (!playable) {
      setVisible(false);
      return;
    }

    cache.paused = isPaused(data);
    cache.liveTime = data.beatmap.time.live;
    cache.liveAccuracy = currentLiveAccuracy(data);
    refreshVisibility();
    scheduleRender();

    if (data.beatmap.checksum) {
      const lazerBeatmapHash = cache.client === 'lazer' && typeof data.files?.beatmap === 'string'
        ? data.files.beatmap.slice(5)
        : '';
      await ensureLoaded(data.beatmap.checksum, lazerBeatmapHash);
    }
  } catch (error) {
    console.log(error);
  }
}, []);
