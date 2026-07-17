'use client';

import { HeartHandshake, Home, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ComponentType,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

// 简单的 className 合并函数
function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

interface NavItem {
  icon: ComponentType<{ className?: string }>;
  label: string;
  href: string;
  // 选中状态的渐变色配置
  activeGradient: string;
  // 选中状态的文字/图标颜色
  activeTextColor: string;
  // 悬浮状态的背景色
  hoverBg: string;
}

interface MobileBottomNavProps {
  /**
   * 主动指定当前激活的路径。当未提供时，自动使用 usePathname() 获取的路径。
   */
  activePath?: string;
}

/**
 * 移动端底部导航栏 - 悬浮胶囊风格
 * 与 PC 端顶部导航保持一致的设计语言
 */
const MobileBottomNav = ({ activePath }: MobileBottomNavProps) => {
  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  // 当前激活路径：优先使用传入的 activePath，否则回退到浏览器地址
  const currentActive = activePath ?? pathname;

  // CareCastTV 精简导航：只保留 首页 / 搜索 / 关怀管理
  const [navItems] = useState<NavItem[]>([
    {
      icon: Home,
      label: '首页',
      href: '/',
      activeGradient: 'bg-linear-to-r from-violet-500 to-purple-600',
      activeTextColor: 'text-white',
      hoverBg: 'hover:bg-violet-500/20',
    },
    {
      icon: Search,
      label: '搜索',
      href: '/search',
      activeGradient: 'bg-linear-to-r from-blue-500 to-cyan-500',
      activeTextColor: 'text-white',
      hoverBg: 'hover:bg-blue-500/20',
    },
    {
      icon: HeartHandshake,
      label: '管理',
      href: '/care-admin',
      activeGradient: 'bg-linear-to-r from-emerald-500 to-teal-500',
      activeTextColor: 'text-white',
      hoverBg: 'hover:bg-emerald-500/20',
    },
  ]);

  // 判断是否激活
  const isActive = useCallback(
    (href: string) => {
      const typeMatch = href.match(/type=([^&]+)/)?.[1];
      const decodedActive = decodeURIComponent(currentActive);
      const decodedItemHref = decodeURIComponent(href);

      // 精确匹配
      if (decodedActive === decodedItemHref) return true;

      // 首页特殊处理
      if (href === '/' && decodedActive === '/') return true;

      // 搜索页特殊处理
      if (href === '/search' && decodedActive.startsWith('/search'))
        return true;

      // 管理区域：三个标签页都高亮"管理"
      if (
        href === '/care-admin' &&
        (decodedActive.startsWith('/care-admin') ||
          decodedActive.startsWith('/settings') ||
          decodedActive.startsWith('/admin'))
      )
        return true;

      // 保留 typeMatch 以兼容将来带 query 的导航项
      void typeMatch;

      return false;
    },
    [currentActive],
  );

  // 滚动到激活项
  const scrollToActiveItem = useCallback(() => {
    const activeIndex = navItems.findIndex((item) => isActive(item.href));
    if (activeIndex === -1) return;

    const activeItem = itemRefs.current[activeIndex];
    if (activeItem) {
      activeItem.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [navItems, isActive]);

  // 路径变化时滚动到激活项
  useEffect(() => {
    const timer = setTimeout(scrollToActiveItem, 100);
    return () => clearTimeout(timer);
  }, [currentActive, scrollToActiveItem]);

  return (
    <nav
      className={cn(
        'md:hidden fixed z-600',
        // 悬浮居中定位
        'left-1/2 -translate-x-1/2',
        // 尺寸限制
        'w-auto max-w-[92vw]',
        // 外观样式 - 磨砂玻璃胶囊 (亮色/暗色自适应)
        'rounded-full',
        'bg-white/92 dark:bg-black/90',
        'backdrop-blur-[6px]',
        'border border-black/5 dark:border-white/10',
        'shadow-lg shadow-black/8 dark:shadow-xl dark:shadow-black/35',
      )}
      style={{
        // 距离底部安全区
        bottom: 'calc(1rem + env(safe-area-inset-bottom))',
      }}
    >
      {/* 横向滚动容器 */}
      <div
        ref={scrollContainerRef}
        className={cn(
          'flex items-center gap-1 px-2 py-2',
          'overflow-x-auto',
          'scroll-smooth',
        )}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* 隐藏 Webkit 滚动条 */}
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {navItems.map((item, index) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              className={cn(
                // 基础样式
                'shrink-0 inline-flex items-center gap-1.5',
                'rounded-full px-3.5 py-2',
                'text-sm font-medium',
                'transition-all duration-300 ease-out',
                'focus:outline-none focus:ring-2 focus:ring-white/30',
                // 点击反馈
                'active:scale-95',
                // 激活状态 (扁平化传入，不使用数组)
                active && item.activeGradient,
                active && item.activeTextColor,
                active && 'shadow-lg',
                active && 'scale-105',
                // 非激活状态 (亮色/暗色自适应)
                !active && 'text-gray-600 dark:text-gray-400',
                !active && item.hoverBg,
                !active && 'hover:text-gray-900 dark:hover:text-white',
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4 shrink-0',
                  'transition-transform duration-300',
                  active && 'drop-shadow-sm',
                )}
              />
              <span className='whitespace-nowrap'>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
