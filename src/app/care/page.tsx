/**
 * CareCastTV 关怀主页（老人视图入口）
 *
 * 设计原则：
 * - 极简：只有「继续播放」和「退出关怀模式」两个按钮，图形为主、文字少、按钮大
 * - 零操作：进入页面即开始倒计时，倒计时结束自动续播上次位置
 * - 防误触：无历史记录时不自动播放；退出必须通过算术验证
 *
 * 维护者：DimLoong
 */
'use client';

import { Play, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  buildCarePlayUrl,
  CARECAST_UPDATE_EVENT,
  getCareConfig,
  resolveResumeTarget,
} from '@/lib/carecast.client';
import { CareResumeTarget } from '@/lib/carecast.types';
import { processImageUrl } from '@/lib/utils';
import { useCareRemoteConfig } from '@/hooks/useCareRemoteConfig';

export default function CareHomePage() {
  const router = useRouter();
  const [target, setTarget] = useState<CareResumeTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const navigatedRef = useRef(false);

  // 关怀主页常驻远程配置轮询（远程点播/改配置在这里生效）
  useCareRemoteConfig(true);

  // 解析续播目标；配置或播放列表变化（含远程下发）时重新解析
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const resolved = await resolveResumeTarget();
      if (cancelled) return;
      setTarget(resolved);
      setLoading(false);
      // 有可播内容才启动倒计时（无历史不自动播放）
      setCountdown(resolved ? getCareConfig().countdownSeconds : null);
    };
    load();
    window.addEventListener(CARECAST_UPDATE_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(CARECAST_UPDATE_EVENT, load);
    };
  }, []);

  const startPlayback = (t: CareResumeTarget | null) => {
    if (!t || navigatedRef.current) return;
    navigatedRef.current = true;
    // 整页跳转：播放页初始化依赖挂载期 effect
    window.location.href = buildCarePlayUrl(t);
  };

  // 倒计时驱动
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      startPlayback(target);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  const episodeLabel =
    target?.episodeIndex && target.totalEpisodes && target.totalEpisodes > 1
      ? `第 ${target.episodeIndex} 集`
      : '';

  return (
    <div className='fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950 text-white select-none'>
      {/* 背景：上次观看的海报虚化铺底，提供"这是我在看的剧"的图形化识别 */}
      {target?.cover && (
        <div
          className='absolute inset-0 bg-cover bg-center opacity-25 blur-2xl scale-110'
          style={{
            backgroundImage: `url(${processImageUrl(target.cover)})`,
          }}
        />
      )}

      <div className='relative z-10 flex flex-col items-center gap-10 px-6 w-full max-w-3xl'>
        {loading ? (
          <div className='text-3xl text-gray-300'>正在准备…</div>
        ) : target ? (
          <>
            {/* 上次观看内容：大海报 + 大标题 */}
            <div className='flex flex-col items-center gap-4'>
              {target.cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={processImageUrl(target.cover)}
                  alt={target.title}
                  className='w-44 h-64 sm:w-52 sm:h-76 object-cover rounded-2xl shadow-2xl ring-4 ring-white/20'
                />
              )}
              <div className='text-center'>
                <h1 className='text-4xl sm:text-5xl font-bold leading-tight'>
                  {target.title}
                </h1>
                {episodeLabel && (
                  <p className='mt-2 text-2xl text-gray-300'>{episodeLabel}</p>
                )}
              </div>
            </div>

            {/* 继续播放：占屏最大的按钮，默认即焦点，点击/回车立即播放 */}
            <button
              autoFocus
              onClick={() => startPlayback(target)}
              className='brand-gradient-bg group flex items-center justify-center gap-4 w-full max-w-xl py-8 rounded-3xl hover:brightness-110 focus:outline-none focus:ring-8 focus:ring-orange-300/60 shadow-2xl transition-all'
            >
              <Play className='w-14 h-14 fill-current' />
              <span className='text-4xl sm:text-5xl font-bold'>
                继续播放
                {countdown !== null && countdown > 0 && (
                  <span className='ml-4 text-orange-100 tabular-nums'>
                    {countdown}
                  </span>
                )}
              </span>
            </button>
            {countdown !== null && countdown > 0 && (
              <p className='text-xl text-gray-300 -mt-4'>
                {countdown} 秒后自动播放
              </p>
            )}
          </>
        ) : (
          // 无任何可播内容：不自动播放，提示由家人配置
          <div className='flex flex-col items-center gap-6 text-center'>
            <div className='text-7xl'>📺</div>
            <h1 className='text-4xl font-bold'>还没有可以播放的节目</h1>
            <p className='text-2xl text-gray-300'>
              请家人在管理页面添加播放内容
            </p>
          </div>
        )}

      </div>

      {/* 退出关怀模式：刻意做小、放角落，避免老人误触 */}
      <button
        onClick={() => router.push('/care/verify')}
        className='fixed bottom-6 right-6 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 text-base transition-colors'
      >
        <Settings className='w-4 h-4' />
        退出关怀模式
      </button>
    </div>
  );
}
