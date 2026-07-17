/**
 * TDesign 暗色模式同步器
 *
 * 项目用 next-themes 在 <html> 上切换 .dark 类，而 TDesign 组件库
 * 依赖 <html theme-mode="dark"> 属性切换暗色变量。本组件监听 class
 * 变化并同步 theme-mode 属性，保证 TDesign 组件跟随全站主题。
 *
 * 维护者：DimLoong
 */
'use client';

import { useEffect } from 'react';

export default function TDesignThemeSync() {
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => {
      const isDark = el.classList.contains('dark');
      if (isDark) {
        el.setAttribute('theme-mode', 'dark');
      } else {
        el.removeAttribute('theme-mode');
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return null;
}
