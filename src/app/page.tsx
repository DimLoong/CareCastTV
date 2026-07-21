/**
 * CareCastTV 管理员首页（精简版）
 *
 * 原 CareCastTV 首页包含豆瓣热门/番剧等发现类内容，CareCastTV 的管理员视图
 * 只保留三件事：进入老人视图、配置关怀模式、继续观看/收藏（选片辅助）。
 *
 * 维护者：DimLoong
 */
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */

'use client';
import { HeartHandshake, Search, Tv } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { Button } from 'tdesign-react';
import 'tdesign-react/lib/_util/react-19-adapter';

import {
  clearAllFavorites,
  getAllFavorites,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from '@/lib/db.client';

import CapsuleSwitch from '@/components/CapsuleSwitch';
import ContinueWatching from '@/components/ContinueWatching';
import { CountdownOutlineButton } from '@/components/CountdownOutlineButton';
import PageLayout from '@/components/PageLayout';
import { useSite } from '@/components/SiteProvider';
import VideoCard from '@/components/VideoCard';

function HomeClient() {
  const [activeTab, setActiveTab] = useState<'home' | 'favorites'>('home');
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

  // 收藏夹数据
  type FavoriteItem = {
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
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);

  const updateFavoriteItems = async (allFavorites: Record<string, any>) => {
    const allPlayRecords = await getAllPlayRecords();
    const sorted = Object.entries(allFavorites)
      .sort(([, a], [, b]) => b.save_time - a.save_time)
      .map(([key, fav]) => {
        const plusIndex = key.indexOf('+');
        const source = key.slice(0, plusIndex);
        const id = key.slice(plusIndex + 1);
        const playRecord = allPlayRecords[key];
        return {
          id,
          source,
          title: fav.title,
          year: fav.year,
          poster: fav.cover,
          episodes: fav.total_episodes,
          source_name: fav.source_name,
          currentEpisode: playRecord?.index,
          search_title: fav?.search_title,
          origin: fav?.origin,
        } as FavoriteItem;
      });
    setFavoriteItems(sorted);
  };

  useEffect(() => {
    if (activeTab !== 'favorites') return;
    const loadFavorites = async () => {
      const allFavorites = await getAllFavorites();
      await updateFavoriteItems(allFavorites);
    };
    loadFavorites();
    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (newFavorites: Record<string, any>) => {
        updateFavoriteItems(newFavorites);
      },
    );
    return unsubscribe;
  }, [activeTab]);

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
            ]}
            active={activeTab}
            onChange={(value) => setActiveTab(value as 'home' | 'favorites')}
          />
        </div>

        <div className='max-w-[95%] mx-auto'>
          {activeTab === 'favorites' ? (
            <section className='mb-8'>
              <div className='mb-4 flex items-center justify-between'>
                <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                  我的收藏
                </h2>
                {favoriteItems.length > 0 && (
                  <button
                    className='text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    onClick={async () => {
                      await clearAllFavorites();
                      setFavoriteItems([]);
                    }}
                  >
                    清空
                  </button>
                )}
              </div>
              <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] sm:gap-x-8'>
                {favoriteItems.map((item) => (
                  <div key={item.id + item.source} className='w-full'>
                    <VideoCard
                      query={item.search_title}
                      {...item}
                      from='favorite'
                      type={item.episodes > 1 ? 'tv' : ''}
                    />
                  </div>
                ))}
                {favoriteItems.length === 0 && (
                  <div className='col-span-full text-center text-gray-500 py-8 dark:text-gray-400'>
                    暂无收藏内容
                  </div>
                )}
              </div>
            </section>
          ) : (
            <ContinueWatching />
          )}
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
