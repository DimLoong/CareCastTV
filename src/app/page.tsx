/**
 * CareCastTV 管理员首页（精简版）
 *
 * 原 CareCastTV 首页包含豆瓣热门/番剧等发现类内容，CareCastTV 的管理员视图
 * 只保留三件事：进入老人视图、配置关怀模式、继续观看/收藏/最近浏览（选片辅助）。
 *
 * 维护者：DimLoong
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';
import { HeartHandshake, Search, Tv } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { Button } from 'tdesign-react';
import 'tdesign-react/lib/_util/react-19-adapter';

import {
  clearAllFavorites,
  clearAllRecentlyViewed,
  deleteFavoritesBatch,
  deleteRecentlyViewedBatch,
  getAllFavorites,
  getAllPlayRecords,
  getAllRecentlyViewed,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { useMultiSelect } from '@/hooks/useMultiSelect';

import CapsuleSwitch from '@/components/CapsuleSwitch';
import ContinueWatching from '@/components/ContinueWatching';
import { CountdownOutlineButton } from '@/components/CountdownOutlineButton';
import PageLayout from '@/components/PageLayout';
import SelectableCard from '@/components/SelectableCard';
import SelectionToolbar from '@/components/SelectionToolbar';
import { useSite } from '@/components/SiteProvider';
import VideoCard from '@/components/VideoCard';

// 通用的"选片辅助"条目：收藏夹与最近浏览共用同一形状
type PickerItem = {
  id: string;
  source: string;
  title: string;
  year: string;
  poster: string;
  episodes: number;
  source_name: string;
  currentEpisode?: number;
  search_title?: string;
  origin?: 'vod' | 'live';
};

function itemsFromMap(
  allItems: Record<string, any>,
  allPlayRecords: Record<string, any>,
): PickerItem[] {
  return Object.entries(allItems)
    .sort(([, a], [, b]) => b.save_time - a.save_time)
    .map(([key, item]) => {
      const plusIndex = key.indexOf('+');
      const source = key.slice(0, plusIndex);
      const id = key.slice(plusIndex + 1);
      const playRecord = allPlayRecords[key];
      return {
        id,
        source,
        title: item.title,
        year: item.year,
        poster: item.cover,
        episodes: item.total_episodes,
        source_name: item.source_name,
        currentEpisode: playRecord?.index,
        search_title: item?.search_title,
        origin: item?.origin,
      } as PickerItem;
    });
}

function HomeClient() {
  const [activeTab, setActiveTab] = useState<'home' | 'favorites' | 'recent'>(
    'home',
  );
  const { siteName, announcement } = useSite();
  const [showAnnouncement, setShowAnnouncement] = useState(false);

  // 检查公告弹窗状态
  useEffect(() => {
    if (typeof window !== 'undefined' && announcement) {
      const hasSeenAnnouncement = localStorage.getItem('hasSeenAnnouncement');
      if (hasSeenAnnouncement !== announcement) {
        setShowAnnouncement(true);
      }
    }
  }, [announcement]);

  const handleCloseAnnouncement = (a: string) => {
    setShowAnnouncement(false);
    localStorage.setItem('hasSeenAnnouncement', a);
  };

  // ---------------- 收藏夹 ----------------
  const [favoriteItems, setFavoriteItems] = useState<PickerItem[]>([]);
  const favoriteKeys = favoriteItems.map((i) => `${i.source}+${i.id}`);
  const favoriteSelect = useMultiSelect(favoriteKeys);
  const [deletingFavorites, setDeletingFavorites] = useState(false);

  useEffect(() => {
    if (activeTab !== 'favorites') return;
    const load = async () => {
      const [allFavorites, allPlayRecords] = await Promise.all([
        getAllFavorites(),
        getAllPlayRecords(),
      ]);
      setFavoriteItems(itemsFromMap(allFavorites, allPlayRecords));
    };
    load();
    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      async (newFavorites: Record<string, any>) => {
        const allPlayRecords = await getAllPlayRecords();
        setFavoriteItems(itemsFromMap(newFavorites, allPlayRecords));
      },
    );
    return unsubscribe;
  }, [activeTab]);

  const handleDeleteSelectedFavorites = async () => {
    setDeletingFavorites(true);
    try {
      await deleteFavoritesBatch(
        Array.from(favoriteSelect.selected).map((key) => {
          const idx = key.indexOf('+');
          return { source: key.slice(0, idx), id: key.slice(idx + 1) };
        }),
      );
      favoriteSelect.exit();
    } finally {
      setDeletingFavorites(false);
    }
  };

  // ---------------- 最近浏览 ----------------
  const [recentItems, setRecentItems] = useState<PickerItem[]>([]);
  const recentKeys = recentItems.map((i) => `${i.source}+${i.id}`);
  const recentSelect = useMultiSelect(recentKeys);
  const [deletingRecent, setDeletingRecent] = useState(false);

  useEffect(() => {
    if (activeTab !== 'recent') return;
    const load = async () => {
      const [allRecent, allPlayRecords] = await Promise.all([
        getAllRecentlyViewed(),
        getAllPlayRecords(),
      ]);
      setRecentItems(itemsFromMap(allRecent, allPlayRecords));
    };
    load();
    const unsubscribe = subscribeToDataUpdates(
      'recentlyViewedUpdated',
      async (newRecent: Record<string, any>) => {
        const allPlayRecords = await getAllPlayRecords();
        setRecentItems(itemsFromMap(newRecent, allPlayRecords));
      },
    );
    return unsubscribe;
  }, [activeTab]);

  const handleDeleteSelectedRecent = async () => {
    setDeletingRecent(true);
    try {
      await deleteRecentlyViewedBatch(
        Array.from(recentSelect.selected).map((key) => {
          const idx = key.indexOf('+');
          return { source: key.slice(0, idx), id: key.slice(idx + 1) };
        }),
      );
      recentSelect.exit();
    } finally {
      setDeletingRecent(false);
    }
  };

  return (
    <PageLayout>
      {/* Hero：品牌 + 快捷入口 */}
      <div className='relative pt-16 pb-8 sm:pt-24 sm:pb-12'>
        <div className='flex flex-col items-center justify-center text-center px-4 gap-6'>
          <h1 className='text-5xl sm:text-7xl font-black tracking-tighter brand-gradient-text select-none'>
            {siteName || 'CareCastTV'}
          </h1>
          {/* Slogan：品牌橙渐变 */}
          <p className='text-base sm:text-xl font-semibold brand-gradient-text'>
            打开就能看 · 家人远程照护
          </p>

          {/* 三个核心入口 */}
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl mt-2'>
            <CountdownOutlineButton
              strokeWidth={6}
              durationMs={8000}
              ringColor='#ff9a3d'
              delayMs={800}
              className='brand-gradient-bg shadow-lg'
            >
              <Link
                href='/care'
                className='tv-focus flex flex-col items-center gap-3 p-6 text-white transition-colors'
              >
                <Tv className='w-10 h-10' />
                <span className='text-lg font-bold'>继续播放</span>
                <span className='text-xs text-orange-100'>
                  倒计时结束自动续播
                </span>
              </Link>
            </CountdownOutlineButton>
            <Link
              href='/care-admin'
              className='tv-focus flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-orange-500/40 hover:border-orange-500 text-gray-800 dark:text-gray-200 transition-colors'
            >
              <HeartHandshake className='w-10 h-10 text-[color:var(--brand-color)]' />
              <span className='text-lg font-bold'>关怀管理</span>
              <span className='text-xs text-gray-400'>
                播放列表 · 策略 · 远程配置
              </span>
            </Link>
            <Link
              href='/search'
              className='tv-focus flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-orange-400 text-gray-800 dark:text-gray-200 transition-colors'
            >
              <Search className='w-10 h-10 text-gray-500' />
              <span className='text-lg font-bold'>搜索选片</span>
              <span className='text-xs text-gray-400'>
                为老人挑选想看的节目
              </span>
            </Link>
          </div>
        </div>
      </div>

      <div className='px-2 sm:px-10 py-4 sm:py-8'>
        {/* 顶部 Tab 切换 */}
        <div className='mb-8 flex justify-center'>
          <CapsuleSwitch
            options={[
              { label: '继续观看', value: 'home' },
              { label: '收藏夹', value: 'favorites' },
              { label: '最近浏览', value: 'recent' },
            ]}
            active={activeTab}
            onChange={(value) =>
              setActiveTab(value as 'home' | 'favorites' | 'recent')
            }
          />
        </div>

        <div className='max-w-[95%] mx-auto'>
          {activeTab === 'favorites' && (
            <section className='mb-8'>
              <SelectionToolbar
                title='我的收藏'
                itemCount={favoriteItems.length}
                selectionMode={favoriteSelect.selectionMode}
                selectedCount={favoriteSelect.selected.size}
                allSelected={favoriteSelect.allSelected}
                deleting={deletingFavorites}
                onEnterSelection={favoriteSelect.enter}
                onExitSelection={favoriteSelect.exit}
                onToggleSelectAll={favoriteSelect.toggleSelectAll}
                onDeleteSelected={handleDeleteSelectedFavorites}
                onClearAll={async () => {
                  await clearAllFavorites();
                  setFavoriteItems([]);
                }}
              />
              <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] sm:gap-x-8'>
                {favoriteItems.map((item) => {
                  const key = `${item.source}+${item.id}`;
                  return (
                    <div key={key} className='w-full'>
                      <SelectableCard
                        selectionMode={favoriteSelect.selectionMode}
                        selected={favoriteSelect.selected.has(key)}
                        onToggle={() => favoriteSelect.toggle(key)}
                      >
                        <VideoCard
                          query={item.search_title}
                          {...item}
                          from='favorite'
                          type={item.episodes > 1 ? 'tv' : ''}
                        />
                      </SelectableCard>
                    </div>
                  );
                })}
                {favoriteItems.length === 0 && (
                  <div className='col-span-full text-center text-gray-500 py-8 dark:text-gray-400'>
                    暂无收藏内容
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'recent' && (
            <section className='mb-8'>
              <SelectionToolbar
                title='最近浏览'
                itemCount={recentItems.length}
                selectionMode={recentSelect.selectionMode}
                selectedCount={recentSelect.selected.size}
                allSelected={recentSelect.allSelected}
                deleting={deletingRecent}
                onEnterSelection={recentSelect.enter}
                onExitSelection={recentSelect.exit}
                onToggleSelectAll={recentSelect.toggleSelectAll}
                onDeleteSelected={handleDeleteSelectedRecent}
                onClearAll={async () => {
                  await clearAllRecentlyViewed();
                  setRecentItems([]);
                }}
              />
              <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] sm:gap-x-8'>
                {recentItems.map((item) => {
                  const key = `${item.source}+${item.id}`;
                  return (
                    <div key={key} className='w-full'>
                      <SelectableCard
                        selectionMode={recentSelect.selectionMode}
                        selected={recentSelect.selected.has(key)}
                        onToggle={() => recentSelect.toggle(key)}
                      >
                        <VideoCard
                          query={item.search_title}
                          {...item}
                          from='recentlyViewed'
                          type={item.episodes > 1 ? 'tv' : ''}
                        />
                      </SelectableCard>
                    </div>
                  );
                })}
                {recentItems.length === 0 && (
                  <div className='col-span-full text-center text-gray-500 py-8 dark:text-gray-400'>
                    暂无最近浏览内容
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'home' && <ContinueWatching />}
        </div>
      </div>

      {/* 公告弹窗 */}
      {announcement && showAnnouncement && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4'>
          <div className='w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900'>
            <h3 className='text-xl font-bold mb-4 text-gray-900 dark:text-gray-100'>
              公告
            </h3>
            <p className='mb-6 text-gray-700 dark:text-gray-200 leading-relaxed'>
              {announcement}
            </p>
            <Button
              onClick={() => handleCloseAnnouncement(announcement)}
              block
              size='large'
              className='brand-btn !rounded-lg !py-3 font-medium'
            >
              我知道了
            </Button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeClient />
    </Suspense>
  );
}
