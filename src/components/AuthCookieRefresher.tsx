/**
 * 登录状态滑动续期 —— 实现"一次输入密码，永久免登录"
 *
 * 背景：Chromium 内核（含安卓电视 WebView）对 cookie 有效期有 400 天硬上限，
 * 无法直接写一个"永久" cookie。本组件在每次打开应用时把 auth cookie
 * 原值重写一遍并续期 400 天——只要电视在 400 天内被打开过一次，
 * 登录就永不过期，效果上等于永久免登录。
 *
 * 维护者：DimLoong
 */
'use client';

import { useEffect } from 'react';

// Chromium 的 cookie 有效期上限即 400 天
const RENEW_DAYS = 400;

export default function AuthCookieRefresher() {
  useEffect(() => {
    try {
      const authCookie = document.cookie
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('auth='));
      if (!authCookie) return;

      const value = authCookie.slice('auth='.length);
      const expires = new Date(
        Date.now() + RENEW_DAYS * 24 * 60 * 60 * 1000,
      ).toUTCString();
      // 与登录接口写入的属性保持一致（path=/、SameSite=Lax、非 httpOnly）
      document.cookie = `auth=${value}; expires=${expires}; path=/; SameSite=Lax`;
    } catch {
      // 续期失败不影响正常使用，等待下次打开再试
    }
  }, []);

  return null;
}
