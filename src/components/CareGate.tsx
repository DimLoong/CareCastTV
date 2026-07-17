/**
 * CareCastTV 路由门禁
 *
 * 关怀模式开启且未通过算术验证解锁时，把所有普通页面的访问重定向到 /care，
 * 保证老人无论如何点击都不会"迷路"到复杂界面。
 *
 * 允许访问的路径：
 * - /care、/care/verify        —— 老人视图本身
 * - /play?care=1               —— 关怀模式播放页
 * - /login、/warning           —— 系统必要页面
 *
 * 维护者：DimLoong
 */
'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

import {
  CARECAST_UPDATE_EVENT,
  getCareConfig,
  isCareUnlocked,
} from '@/lib/carecast.client';

function CareGateInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const check = () => {
      const config = getCareConfig();
      if (!config.careModeEnabled || isCareUnlocked()) return;

      // 注意：/care-admin 属于管理员视图，必须验证解锁后才能访问
      const isAllowed =
        pathname === '/care' ||
        pathname.startsWith('/care/') ||
        (pathname === '/play' && searchParams.get('care') === '1') ||
        pathname === '/login' ||
        pathname === '/warning';

      if (!isAllowed) {
        router.replace('/care');
      }
    };

    check();
    // 远程配置把 careModeEnabled 打开时也要立即生效
    window.addEventListener(CARECAST_UPDATE_EVENT, check);
    return () => window.removeEventListener(CARECAST_UPDATE_EVENT, check);
  }, [pathname, searchParams, router]);

  return null;
}

export default function CareGate() {
  // useSearchParams 需要 Suspense 边界（App Router 要求）
  return (
    <Suspense fallback={null}>
      <CareGateInner />
    </Suspense>
  );
}
