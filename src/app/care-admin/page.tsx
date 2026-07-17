/**
 * CareCastTV 管理员配置视图
 *
 * 家属/管理员在此完成：
 * 1. 关怀模式开关与策略（续播倒计时、验证超时、跨剧连播、列表循环）
 * 2. 播放列表编排（搜索添加、排序、删除、指定当前播放项）
 * 3. 远程配置（GitHub 配置文件地址、轮询间隔、导出配置 JSON）
 *
 * 维护者：DimLoong
 */
'use client';

/* eslint-disable @next/next/no-img-element */

import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Tv,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import {
  addPlaylistItem,
  applyRemoteConfigFile,
  buildCarePlayUrl,
  CARECAST_UPDATE_EVENT,
  exportRemoteConfigFile,
  getCareConfig,
  getCarePlaylist,
  getCareRemoteState,
  movePlaylistItem,
  removePlaylistItem,
  saveCareConfig,
  saveCarePlaylist,
  setCareUnlocked,
  setPlaylistCurrentItem,
} from '@/lib/carecast.client';
import {
  CareConfig,
  CarePlaylist,
  CareRemoteState,
} from '@/lib/carecast.types';
import { getAllPlayRecords } from '@/lib/db.client';
import { SearchResult } from '@/lib/types';
import { processImageUrl } from '@/lib/utils';
import { fetchRemoteConfigOnce } from '@/hooks/useCareRemoteConfig';

import ManageTabs from '@/components/ManageTabs';
import PageLayout from '@/components/PageLayout';

/** 播放记录摘要：用于在播放列表项上显示观看进度 */
type RecordMap = Record<
  string,
  { index: number; total_episodes: number; save_time: number }
>;

export default function CareAdminPage() {
  const [config, setConfig] = useState<CareConfig | null>(null);
  const [playlist, setPlaylist] = useState<CarePlaylist | null>(null);
  const [remoteState, setRemoteState] = useState<CareRemoteState | null>(null);
  const [records, setRecords] = useState<RecordMap>({});

  // 搜索状态
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState('');

  // 远程配置测试状态
  const [remoteTesting, setRemoteTesting] = useState(false);
  const [remoteTestResult, setRemoteTestResult] = useState('');
  const [copied, setCopied] = useState(false);

  // 读取本地数据；任何 carecast 数据变化时刷新
  const reload = useCallback(() => {
    setConfig(getCareConfig());
    setPlaylist(getCarePlaylist());
    setRemoteState(getCareRemoteState());
    getAllPlayRecords()
      .then((r) => setRecords(r as unknown as RecordMap))
      .catch(() => setRecords({}));
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(CARECAST_UPDATE_EVENT, reload);
    return () => window.removeEventListener(CARECAST_UPDATE_EVENT, reload);
  }, [reload]);

  const updateConfig = (patch: Partial<CareConfig>) => {
    if (!config) return;
    saveCareConfig({ ...config, ...patch });
  };

  const updateRemote = (patch: Partial<CareConfig['remote']>) => {
    if (!config) return;
    saveCareConfig({ ...config, remote: { ...config.remote, ...patch } });
  };

  const doSearch = async () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setSearchError('');
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`搜索失败 (${res.status})`);
      const body = await res.json();
      setSearchResults(body.results || []);
      if ((body.results || []).length === 0) setSearchError('没有找到结果');
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : '搜索失败');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const addToPlaylist = (result: SearchResult) => {
    addPlaylistItem({
      source: result.source,
      vodId: result.id,
      title: result.title,
      searchTitle: query.trim() || result.title,
      cover: result.poster,
      year: result.year,
      sourceName: result.source_name,
      totalEpisodes: result.episodes?.length || 1,
    });
  };

  const testRemote = async () => {
    if (!config?.remote.url || remoteTesting) return;
    setRemoteTesting(true);
    setRemoteTestResult('');
    try {
      const file = await fetchRemoteConfigOnce(
        config.remote.url,
        config.remote.token,
      );
      const result = applyRemoteConfigFile(file);
      setRemoteTestResult(
        result.applied
          ? `✅ 拉取成功并已应用（version ${file.version}）`
          : `✅ 拉取成功，version ${file.version} 不高于本地已应用版本，未重复应用`,
      );
    } catch (err) {
      setRemoteTestResult(
        `❌ ${err instanceof Error ? err.message : '拉取失败'}`,
      );
    } finally {
      setRemoteTesting(false);
    }
  };

  const copyExportJson = async () => {
    const json = JSON.stringify(exportRemoteConfigFile(), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板不可用时降级为下载文件
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'carecast.json';
      a.click();
      URL.revokeObjectURL(a.href);
    }
  };

  const enterCareMode = () => {
    if (!config) return;
    saveCareConfig({ ...config, careModeEnabled: true });
    // 清除解锁标记，立即进入老人视图
    setCareUnlocked(false);
    window.location.href = '/care';
  };

  if (!config || !playlist) {
    return (
      <PageLayout activePath='/care-admin'>
        <div className='flex items-center justify-center min-h-[50vh] text-gray-500'>
          加载中…
        </div>
      </PageLayout>
    );
  }

  const inPlaylist = new Set(
    playlist.items.map((i) => `${i.source}+${i.vodId}`),
  );

  return (
    <PageLayout activePath='/care-admin'>
      <div className='max-w-4xl mx-auto px-4 py-8 space-y-8'>
        <ManageTabs />
        <header className='flex flex-wrap items-center justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
              关怀模式管理
            </h1>
            <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
              为老人配置自动续播的播放列表与播放策略
            </p>
          </div>
          <button
            onClick={enterCareMode}
            className='flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold shadow transition-colors'
          >
            <Tv className='w-5 h-5' />
            进入老人视图
          </button>
        </header>

        {/* ------------------------- 策略设置 ------------------------- */}
        <section className='rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 p-6 space-y-5'>
          <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
            播放策略
          </h2>

          <label className='flex items-center justify-between gap-4'>
            <span className='text-gray-700 dark:text-gray-300'>
              启用关怀模式
              <span className='block text-xs text-gray-400'>
                开启后应用将被限制在老人视图内，退出需算术验证
              </span>
            </span>
            <input
              type='checkbox'
              checked={config.careModeEnabled}
              onChange={(e) => updateConfig({ careModeEnabled: e.target.checked })}
              className='w-5 h-5 accent-green-600'
            />
          </label>

          <label className='flex items-center justify-between gap-4'>
            <span className='text-gray-700 dark:text-gray-300'>
              自动续播倒计时（秒）
              <span className='block text-xs text-gray-400'>
                老人主页停留该时长后自动播放
              </span>
            </span>
            <input
              type='number'
              min={0}
              max={600}
              value={config.countdownSeconds}
              onChange={(e) =>
                updateConfig({
                  countdownSeconds: Math.max(
                    0,
                    parseInt(e.target.value, 10) || 0,
                  ),
                })
              }
              className='w-24 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-right'
            />
          </label>

          <label className='flex items-center justify-between gap-4'>
            <span className='text-gray-700 dark:text-gray-300'>
              验证页超时（秒）
              <span className='block text-xs text-gray-400'>
                退出验证页无操作该时长后自动回退
              </span>
            </span>
            <input
              type='number'
              min={5}
              max={600}
              value={config.verifyTimeoutSeconds}
              onChange={(e) =>
                updateConfig({
                  verifyTimeoutSeconds: Math.max(
                    5,
                    parseInt(e.target.value, 10) || 30,
                  ),
                })
              }
              className='w-24 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-right'
            />
          </label>

          <label className='flex items-center justify-between gap-4'>
            <span className='text-gray-700 dark:text-gray-300'>
              跨剧自动连播
              <span className='block text-xs text-gray-400'>
                一部剧播完后自动播放列表中的下一部
              </span>
            </span>
            <input
              type='checkbox'
              checked={config.autoAdvance}
              onChange={(e) => updateConfig({ autoAdvance: e.target.checked })}
              className='w-5 h-5 accent-green-600'
            />
          </label>

          <label className='flex items-center justify-between gap-4'>
            <span className='text-gray-700 dark:text-gray-300'>
              列表循环
              <span className='block text-xs text-gray-400'>
                最后一部播完后回到第一部重新开始
              </span>
            </span>
            <input
              type='checkbox'
              checked={playlist.loop}
              onChange={(e) =>
                saveCarePlaylist({ ...playlist, loop: e.target.checked })
              }
              className='w-5 h-5 accent-green-600'
            />
          </label>
        </section>

        {/* ------------------------- 播放列表 ------------------------- */}
        <section className='rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 p-6 space-y-4'>
          <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
            播放列表（按顺序连播）
          </h2>

          {playlist.items.length === 0 ? (
            <p className='text-gray-400 text-sm'>
              列表为空。在下方搜索节目并添加。
            </p>
          ) : (
            <ul className='space-y-3'>
              {playlist.items.map((item, idx) => {
                const rec = records[`${item.source}+${item.vodId}`];
                const isCurrent = playlist.currentItemId === item.id;
                return (
                  <li
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      isCurrent
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <span className='w-6 text-center text-gray-400 font-mono'>
                      {idx + 1}
                    </span>
                    {item.cover && (
                      <img
                        src={processImageUrl(item.cover)}
                        alt={item.title}
                        className='w-12 h-16 object-cover rounded-lg'
                      />
                    )}
                    <div className='flex-1 min-w-0'>
                      <p className='font-medium text-gray-900 dark:text-gray-100 truncate'>
                        {item.title}
                        {isCurrent && (
                          <span className='ml-2 text-xs px-2 py-0.5 rounded-full bg-green-600 text-white'>
                            当前
                          </span>
                        )}
                      </p>
                      <p className='text-xs text-gray-400 mt-0.5'>
                        {item.sourceName || item.source}
                        {item.totalEpisodes
                          ? ` · 共 ${item.totalEpisodes} 集`
                          : ''}
                        {rec
                          ? ` · 看到第 ${rec.index} 集`
                          : ' · 未观看'}
                      </p>
                    </div>
                    <div className='flex items-center gap-1'>
                      <button
                        title='立即试播'
                        onClick={() => {
                          window.open(
                            buildCarePlayUrl({
                              source: item.source,
                              vodId: item.vodId,
                              title: item.title,
                              searchTitle: item.searchTitle,
                              year: item.year,
                            }),
                            '_blank',
                          );
                        }}
                        className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'
                      >
                        <Play className='w-4 h-4' />
                      </button>
                      <button
                        title='设为当前播放项'
                        onClick={() => setPlaylistCurrentItem(item.id)}
                        className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 disabled:opacity-30'
                        disabled={isCurrent}
                      >
                        <Tv className='w-4 h-4' />
                      </button>
                      <button
                        title='上移'
                        onClick={() => movePlaylistItem(item.id, -1)}
                        disabled={idx === 0}
                        className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 disabled:opacity-30'
                      >
                        <ArrowUp className='w-4 h-4' />
                      </button>
                      <button
                        title='下移'
                        onClick={() => movePlaylistItem(item.id, 1)}
                        disabled={idx === playlist.items.length - 1}
                        className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 disabled:opacity-30'
                      >
                        <ArrowDown className='w-4 h-4' />
                      </button>
                      <button
                        title='删除'
                        onClick={() => removePlaylistItem(item.id)}
                        className='p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500'
                      >
                        <Trash2 className='w-4 h-4' />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* 搜索添加 */}
          <div className='pt-2 border-t border-gray-100 dark:border-gray-800 space-y-3'>
            <div className='flex gap-2'>
              <input
                type='text'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                placeholder='搜索剧名添加到播放列表…'
                className='flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent'
              />
              <button
                onClick={doSearch}
                disabled={searching}
                className='flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium disabled:opacity-50 transition-opacity'
              >
                <Search className='w-4 h-4' />
                {searching ? '搜索中…' : '搜索'}
              </button>
            </div>
            {searchError && (
              <p className='text-sm text-red-500'>{searchError}</p>
            )}
            {searchResults.length > 0 && (
              <ul className='grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto'>
                {searchResults.map((r) => {
                  const added = inPlaylist.has(`${r.source}+${r.id}`);
                  return (
                    <li
                      key={`${r.source}+${r.id}`}
                      className='flex items-center gap-3 p-2 rounded-xl border border-gray-200 dark:border-gray-800'
                    >
                      {r.poster && (
                        <img
                          src={processImageUrl(r.poster)}
                          alt={r.title}
                          className='w-10 h-14 object-cover rounded-md'
                        />
                      )}
                      <div className='flex-1 min-w-0'>
                        <p className='text-sm font-medium truncate text-gray-900 dark:text-gray-100'>
                          {r.title}
                        </p>
                        <p className='text-xs text-gray-400'>
                          {r.source_name} · {r.year || '年份未知'} ·{' '}
                          {r.episodes?.length || 1} 集
                        </p>
                      </div>
                      <button
                        onClick={() => addToPlaylist(r)}
                        disabled={added}
                        className='flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
                      >
                        <Plus className='w-3.5 h-3.5' />
                        {added ? '已添加' : '添加'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ------------------------- 远程配置 ------------------------- */}
        <section className='rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 p-6 space-y-5'>
          <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
            远程配置（GitHub）
          </h2>
          <p className='text-sm text-gray-500 dark:text-gray-400'>
            把配置 JSON 提交到 GitHub 仓库后，老人端会定时拉取并自动生效。
            修改配置后记得把下方导出的 JSON 更新到仓库（version 需递增）。
          </p>

          <label className='flex items-center justify-between gap-4'>
            <span className='text-gray-700 dark:text-gray-300'>启用远程配置轮询</span>
            <input
              type='checkbox'
              checked={config.remote.enabled}
              onChange={(e) => updateRemote({ enabled: e.target.checked })}
              className='w-5 h-5 accent-green-600'
            />
          </label>

          <label className='block'>
            <span className='text-sm text-gray-700 dark:text-gray-300'>
              配置文件地址（raw 链接或 GitHub 文件页链接）
            </span>
            <input
              type='url'
              value={config.remote.url}
              onChange={(e) => updateRemote({ url: e.target.value.trim() })}
              placeholder='https://raw.githubusercontent.com/你的用户名/仓库/main/carecast.json'
              className='mt-1 w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent text-sm'
            />
          </label>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <label className='block'>
              <span className='text-sm text-gray-700 dark:text-gray-300'>
                轮询间隔（秒，最小 10）
              </span>
              <input
                type='number'
                min={10}
                value={config.remote.pollIntervalSeconds}
                onChange={(e) =>
                  updateRemote({
                    pollIntervalSeconds: Math.max(
                      10,
                      parseInt(e.target.value, 10) || 60,
                    ),
                  })
                }
                className='mt-1 w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent text-sm'
              />
            </label>
            <label className='block'>
              <span className='text-sm text-gray-700 dark:text-gray-300'>
                GitHub Token（私有仓库需要，可留空）
              </span>
              <input
                type='password'
                value={config.remote.token || ''}
                onChange={(e) =>
                  updateRemote({ token: e.target.value.trim() || undefined })
                }
                placeholder='ghp_…'
                className='mt-1 w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent text-sm'
              />
            </label>
          </div>

          <div className='flex flex-wrap gap-3'>
            <button
              onClick={testRemote}
              disabled={remoteTesting || !config.remote.url}
              className='flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium disabled:opacity-50'
            >
              <RefreshCw
                className={`w-4 h-4 ${remoteTesting ? 'animate-spin' : ''}`}
              />
              立即拉取测试
            </button>
            <button
              onClick={copyExportJson}
              className='flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300'
            >
              {copied ? (
                <Download className='w-4 h-4 text-green-500' />
              ) : (
                <Copy className='w-4 h-4' />
              )}
              {copied ? '已复制' : '导出当前配置 JSON'}
            </button>
          </div>

          {remoteTestResult && (
            <p className='text-sm text-gray-600 dark:text-gray-300'>
              {remoteTestResult}
            </p>
          )}

          {remoteState && remoteState.lastFetchAt > 0 && (
            <p className='text-xs text-gray-400'>
              上次拉取：
              {new Date(remoteState.lastFetchAt).toLocaleString('zh-CN', {
                hour12: false,
              })}
              {remoteState.lastError
                ? ` · 错误：${remoteState.lastError}`
                : ` · 已应用 version ${remoteState.lastAppliedVersion}`}
            </p>
          )}
        </section>
      </div>
    </PageLayout>
  );
}
