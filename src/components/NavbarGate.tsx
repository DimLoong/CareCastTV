'use client';

import { usePathname } from 'next/navigation';
import React from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

export default function NavbarGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // 关怀模式（老人视图）页面不显示导航栏，保持界面极简
  // 注意 /care-admin 是管理员页面，需要保留导航栏
  if (pathname === '/care' || pathname.startsWith('/care/')) {
    return null;
  }

  // 如果在登录页或注册页且未登录，则不显示导航栏
  if (pathname === '/login' || pathname === '/register') {
    const auth = getAuthInfoFromBrowserCookie();
    if (!auth) return null;
  }

  return <>{children}</>;
}
