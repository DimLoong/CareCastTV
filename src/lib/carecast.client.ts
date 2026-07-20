/**
 * CareCastTV 客户端存储层（浏览器端）
 *
 * 当前实现基于 localStorage（单机模式），并通过「远程配置文件轮询」实现远程控制：
 * 管理员把 carecast.json 放在 GitHub 仓库中，老人端定时拉取并应用。
 *
 * 未来若切换到服务端存储（redis/upstash），只需把本文件内的
 * localStorage 读写替换为对 /api/carecast/* 的调用，接口签名保持不变。
 *
 * 维护者：DimLoong
 */
'use client';

import { getAllPlayRecords, type PlayRecord } from '@/lib/db.client';

import {
  CareConfig,
  CarePlaylist,
  CarePlaylistItem,
  CareRemoteFile,
  CareRemoteState,
  CareResumeTarget,
  DEFAULT_CARE_CONFIG,
} from './carecast.types';

// localStorage / sessionStorage 键名
const CONFIG_KEY = 'carecast_config';
const PLAYLIST_KEY = 'carecast_playlist';
const REMOTE_STATE_KEY = 'carecast_remote_state';
/** 算术验证通过后的解锁标记（sessionStorage，关闭浏览器自动失效） */
const UNLOCK_KEY = 'carecast_unlocked';

/** 配置变化事件，供 UI 订阅刷新 */
export const CARECAST_UPDATE_EVENT = 'carecastDataUpdated';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function emitUpdate() {
  if (isBrowser()) {
    window.dispatchEvent(new CustomEvent(CARECAST_UPDATE_EVENT));
  }
}

function readJson<T>(key: string): T | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// CareConfig
// ---------------------------------------------------------------------------

export function getCareConfig(): CareConfig {
  const stored = readJson<Partial<CareConfig>>(CONFIG_KEY);
  // 与默认值合并，保证新增字段有默认值
  return {
    ...DEFAULT_CARE_CONFIG,
    ...stored,
    remote: { ...DEFAULT_CARE_CONFIG.remote, ...stored?.remote },
  };
}

export function saveCareConfig(config: CareConfig) {
  writeJson(CONFIG_KEY, { ...config, updatedAt: Date.now() });
  emitUpdate();
}

// ---------------------------------------------------------------------------
// CarePlaylist
// ---------------------------------------------------------------------------

const EMPTY_PLAYLIST: CarePlaylist = {
  items: [],
  currentItemId: null,
  loop: false,
  updatedAt: 0,
};

export function getCarePlaylist(): CarePlaylist {
  const stored = readJson<CarePlaylist>(PLAYLIST_KEY);
  return stored ? { ...EMPTY_PLAYLIST, ...stored } : { ...EMPTY_PLAYLIST };
}

export function saveCarePlaylist(playlist: CarePlaylist) {
  writeJson(PLAYLIST_KEY, { ...playlist, updatedAt: Date.now() });
  emitUpdate();
}

/** 生成播放列表项 id */
export function generatePlaylistItemId(): string {
  return `pli_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function addPlaylistItem(
  item: Omit<CarePlaylistItem, 'id'>,
): CarePlaylist {
  const playlist = getCarePlaylist();
  // 同一 source+vodId 不重复添加
  const exists = playlist.items.some(
    (i) => i.source === item.source && i.vodId === item.vodId,
  );
  if (!exists) {
    playlist.items.push({ ...item, id: generatePlaylistItemId() });
    saveCarePlaylist(playlist);
  }
  return playlist;
}

export function removePlaylistItem(itemId: string): CarePlaylist {
  const playlist = getCarePlaylist();
  playlist.items = playlist.items.filter((i) => i.id !== itemId);
  if (playlist.currentItemId === itemId) {
    playlist.currentItemId = null;
  }
  saveCarePlaylist(playlist);
  return playlist;
}

/** 上移/下移列表项（direction: -1 上移, 1 下移） */
export function movePlaylistItem(
  itemId: string,
  direction: -1 | 1,
): CarePlaylist {
  const playlist = getCarePlaylist();
  const idx = playlist.items.findIndex((i) => i.id === itemId);
  const target = idx + direction;
  if (idx >= 0 && target >= 0 && target < playlist.items.length) {
    const [moved] = playlist.items.splice(idx, 1);
    playlist.items.splice(target, 0, moved);
    saveCarePlaylist(playlist);
  }
  return playlist;
}

export function setPlaylistCurrentItem(itemId: string | null): CarePlaylist {
  const playlist = getCarePlaylist();
  playlist.currentItemId = itemId;
  saveCarePlaylist(playlist);
  return playlist;
}

/** 根据 source+vodId 把对应列表项标记为当前项（播放页切换剧集时调用） */
export function markPlaylistCurrentBySource(source: string, vodId: string) {
  const playlist = getCarePlaylist();
  const item = playlist.items.find(
    (i) => i.source === source && i.vodId === vodId,
  );
  if (item && playlist.currentItemId !== item.id) {
    playlist.currentItemId = item.id;
    saveCarePlaylist(playlist);
  }
}

/**
 * 查找播放列表中某一项的下一项（跨剧连播核心逻辑）。
 * 当前剧不在列表中时返回 null；已是最后一项时按 loop 决定回到第一项或返回 null。
 */
export function findNextPlaylistItem(
  source: string,
  vodId: string,
): CarePlaylistItem | null {
  const playlist = getCarePlaylist();
  if (playlist.items.length === 0) return null;
  const idx = playlist.items.findIndex(
    (i) => i.source === source && i.vodId === vodId,
  );
  if (idx < 0) return null;
  if (idx < playlist.items.length - 1) return playlist.items[idx + 1];
  return playlist.loop ? playlist.items[0] : null;
}

// ---------------------------------------------------------------------------
// 续播目标解析（关怀主页"继续播放"按钮的数据来源）
// ---------------------------------------------------------------------------

/**
 * 解析"继续播放"应该播什么：
 * 1. 播放列表非空：优先 currentItemId 指定项；否则选列表中播放记录最新的一项；
 *    列表中所有项都没看过时，从第一项开始。
 * 2. 播放列表为空：回退到全局最新播放记录（保持"打开即续播"可用）。
 * 3. 什么都没有：返回 null（按 PRD 不自动播放）。
 */
export async function resolveResumeTarget(): Promise<CareResumeTarget | null> {
  const playlist = getCarePlaylist();
  let records: Record<string, PlayRecord> = {};
  try {
    records = await getAllPlayRecords();
  } catch {
    // 播放记录读取失败不阻塞：仍可从播放列表第一项开始
  }

  const toTarget = (
    item: CarePlaylistItem,
    record?: (typeof records)[string],
  ): CareResumeTarget => ({
    source: item.source,
    vodId: item.vodId,
    title: item.title,
    searchTitle: item.searchTitle || record?.search_title,
    year: item.year,
    cover: item.cover || record?.cover,
    episodeIndex: record?.index,
    playTimeSeconds: record?.play_time,
    totalEpisodes: item.totalEpisodes || record?.total_episodes,
  });

  const recordOf = (item: CarePlaylistItem) =>
    records[`${item.source}+${item.vodId}`];

  if (playlist.items.length > 0) {
    // 1a. 管理员显式指定的当前项优先
    if (playlist.currentItemId) {
      const current = playlist.items.find(
        (i) => i.id === playlist.currentItemId,
      );
      if (current) return toTarget(current, recordOf(current));
    }
    // 1b. 否则选列表中最近看过的一项
    let latest: CarePlaylistItem | null = null;
    let latestTime = -1;
    for (const item of playlist.items) {
      const rec = recordOf(item);
      if (rec && rec.save_time > latestTime) {
        latest = item;
        latestTime = rec.save_time;
      }
    }
    if (latest) return toTarget(latest, recordOf(latest));
    // 1c. 都没看过：从第一项开始
    return toTarget(playlist.items[0]);
  }

  // 2. 播放列表为空：回退到全局最新播放记录
  const entries = Object.entries(records);
  if (entries.length === 0) return null;
  entries.sort(([, a], [, b]) => b.save_time - a.save_time);
  const [key, rec] = entries[0];
  const plusIdx = key.indexOf('+');
  return {
    source: key.slice(0, plusIdx),
    vodId: key.slice(plusIdx + 1),
    title: rec.title,
    searchTitle: rec.search_title,
    year: rec.year,
    cover: rec.cover,
    episodeIndex: rec.index,
    playTimeSeconds: rec.play_time,
    totalEpisodes: rec.total_episodes,
  };
}

/** 构造关怀模式播放页 URL（care=1 会让播放页进入极简模式） */
export function buildCarePlayUrl(target: {
  source: string;
  vodId: string;
  title?: string;
  searchTitle?: string;
  year?: string;
}): string {
  const params = new URLSearchParams();
  params.set('source', target.source);
  params.set('id', target.vodId);
  if (target.title) params.set('title', target.title);
  if (target.searchTitle) params.set('stitle', target.searchTitle);
  if (target.year) params.set('year', target.year);
  params.set('care', '1');
  return `/play?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// 关怀模式解锁状态（算术验证）
// ---------------------------------------------------------------------------

/** 验证通过后本次会话内不再被门禁拦截 */
export function isCareUnlocked(): boolean {
  if (!isBrowser()) return false;
  return sessionStorage.getItem(UNLOCK_KEY) === '1';
}

export function setCareUnlocked(unlocked: boolean) {
  if (!isBrowser()) return;
  if (unlocked) {
    sessionStorage.setItem(UNLOCK_KEY, '1');
  } else {
    sessionStorage.removeItem(UNLOCK_KEY);
  }
  emitUpdate();
}

// ---------------------------------------------------------------------------
// 远程配置应用
// ---------------------------------------------------------------------------

export function getCareRemoteState(): CareRemoteState {
  return (
    readJson<CareRemoteState>(REMOTE_STATE_KEY) || {
      lastAppliedVersion: -1,
      lastCommandId: null,
      lastFetchAt: 0,
      lastError: null,
    }
  );
}

export function saveCareRemoteState(state: CareRemoteState) {
  writeJson(REMOTE_STATE_KEY, state);
}

export interface ApplyRemoteResult {
  applied: boolean;
  configChanged: boolean;
  playlistChanged: boolean;
  /** 需要立即执行的远程点播指令（去重后），由调用方负责跳转播放 */
  playNow: CareRemoteFile['command'] | null;
}

/**
 * 应用远程配置文件：
 * - version 必须大于本地已应用版本，否则跳过（幂等）
 * - command 按 id 去重，同一指令只执行一次
 */
export function applyRemoteConfigFile(file: CareRemoteFile): ApplyRemoteResult {
  const state = getCareRemoteState();
  const result: ApplyRemoteResult = {
    applied: false,
    configChanged: false,
    playlistChanged: false,
    playNow: null,
  };

  // 指令去重独立于 version 判断：新指令即使 version 未变也应执行
  if (file.command && file.command.id !== state.lastCommandId) {
    result.playNow = file.command;
    state.lastCommandId = file.command.id;
  }

  if (file.version > state.lastAppliedVersion) {
    if (file.config) {
      const local = getCareConfig();
      saveCareConfig({ ...local, ...file.config });
      result.configChanged = true;
    }
    if (file.playlist) {
      const local = getCarePlaylist();
      saveCarePlaylist({
        items: file.playlist.items,
        currentItemId:
          file.playlist.currentItemId !== undefined
            ? file.playlist.currentItemId
            : local.currentItemId,
        loop: file.playlist.loop ?? local.loop,
        updatedAt: Date.now(),
      });
      result.playlistChanged = true;
    }
    state.lastAppliedVersion = file.version;
    result.applied = true;
  }

  state.lastFetchAt = Date.now();
  state.lastError = null;
  saveCareRemoteState(state);
  return result;
}

/** 记录一次失败的远程拉取（供管理员页显示诊断信息） */
export function recordRemoteFetchError(message: string) {
  const state = getCareRemoteState();
  state.lastFetchAt = Date.now();
  state.lastError = message;
  saveCareRemoteState(state);
}

/**
 * 导出当前本地配置为远程配置文件 JSON（管理员复制后提交到 GitHub 仓库）。
 * version 使用当前时间戳，保证单调递增。
 */
export function exportRemoteConfigFile(): CareRemoteFile {
  const config = getCareConfig();
  const playlist = getCarePlaylist();
  return {
    version: Date.now(),
    config: {
      careModeEnabled: config.careModeEnabled,
      countdownSeconds: config.countdownSeconds,
      verifyTimeoutSeconds: config.verifyTimeoutSeconds,
      autoAdvance: config.autoAdvance,
    },
    playlist: {
      items: playlist.items,
      currentItemId: playlist.currentItemId,
      loop: playlist.loop,
    },
  };
}
