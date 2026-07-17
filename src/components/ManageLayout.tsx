/**
 * 管理区域布局（电视端左右结构）
 *
 * 「管理」区域统一采用电视 UI 逻辑：左侧是纵向 tab 列表，右侧是对应内容。
 * 左侧包含两层：
 * 1. 主 tab：关怀管理 / 本地设置 / 管理员设置（路由跳转）
 * 2. 子 tab：当前页面内部的分区（如管理员设置的 站点配置/视频源配置…），
 *    由页面通过 subTabs/activeSubTab/onSubTabChange 传入，渲染在激活主 tab 下方。
 *
 * 移动端（<md）退化为顶部横向 pill，保证手机可用。
 * 所有可聚焦元素带 .tv-focus 焦点环，适配遥控器 D-pad 操作。
 *
 * 维护者：DimLoong
 */
'use client';

import { HeartHandshake, LucideIcon, Settings, Shield } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

const MAIN_TABS = [
  { href: '/care-admin', label: '关怀管理', icon: HeartHandshake },
  { href: '/settings', label: '本地设置', icon: Settings },
  { href: '/admin', label: '管理员设置', icon: Shield },
] as const;

export interface ManageSubTab {
  key: string;
  label: string;
  icon?: LucideIcon;
}

interface ManageLayoutProps {
  children: ReactNode;
  /** 当前页面内部的子分区列表（可选） */
  subTabs?: ManageSubTab[];
  activeSubTab?: string;
  onSubTabChange?: (key: string) => void;
}

export default function ManageLayout({
  children,
  subTabs,
  activeSubTab,
  onSubTabChange,
}: ManageLayoutProps) {
  const pathname = usePathname();

  const renderSubTabs = (compact: boolean) =>
    subTabs && subTabs.length > 0 ? (
      <div
        className={
          compact
            ? 'flex gap-1.5 overflow-x-auto scrollbar-hide pb-1'
            : 'mt-1 mb-2 ml-4 pl-3 border-l-2 border-[color:var(--brand-color)]/30 space-y-1'
        }
      >
        {subTabs.map((sub) => {
          const active = activeSubTab === sub.key;
          const SubIcon = sub.icon;
          return (
            <button
              key={sub.key}
              onClick={() => onSubTabChange?.(sub.key)}
              className={
                compact
                  ? `tv-focus shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      active
                        ? 'brand-gradient-bg shadow'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                    }`
                  : `tv-focus w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                      active
                        ? 'font-semibold text-[color:var(--brand-color)] bg-orange-50 dark:bg-orange-950/40'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`
              }
            >
              {SubIcon && <SubIcon className='w-4 h-4 shrink-0' />}
              <span className='truncate'>{sub.label}</span>
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div className='flex flex-col md:flex-row gap-6 md:gap-8 items-start'>
      {/* ---------- 左侧纵向 tab（电视/桌面） ---------- */}
      <aside className='hidden md:block w-56 shrink-0 sticky top-20'>
        <nav className='rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 p-3 space-y-1'>
          {MAIN_TABS.map((tab) => {
            const active = pathname === tab.href;
            const Icon = tab.icon;
            return (
              <div key={tab.href}>
                <Link
                  href={tab.href}
                  className={`tv-focus flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? 'brand-gradient-bg shadow-lg'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className='w-4.5 h-4.5 shrink-0' />
                  {tab.label}
                </Link>
                {/* 当前主 tab 下方渲染页面内部的子 tab */}
                {active && renderSubTabs(false)}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ---------- 移动端顶部横向 pill ---------- */}
      <div className='md:hidden w-full space-y-2'>
        <div className='flex justify-center'>
          <div className='inline-flex items-center gap-1 p-1 rounded-full bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700'>
            {MAIN_TABS.map((tab) => {
              const active = pathname === tab.href;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`tv-focus flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    active
                      ? 'brand-gradient-bg shadow'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className='w-4 h-4' />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
        {renderSubTabs(true)}
      </div>

      {/* ---------- 右侧内容区 ---------- */}
      <main className='flex-1 min-w-0 w-full'>{children}</main>
    </div>
  );
}
