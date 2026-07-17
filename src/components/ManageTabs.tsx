/**
 * 管理区域顶部标签栏
 *
 * 「管理」在导航上是一个入口，内部由三个页面组成，通过本组件互相切换：
 * - 关怀管理  /care-admin  （播放列表、播放策略、远程配置）
 * - 本地设置  /settings    （豆瓣代理、缓冲模式等本机设置）
 * - 管理员设置 /admin       （播放源、用户、站点配置）
 *
 * 维护者：DimLoong
 */
'use client';

import { HeartHandshake, Settings, Shield } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/care-admin', label: '关怀管理', icon: HeartHandshake },
  { href: '/settings', label: '本地设置', icon: Settings },
  { href: '/admin', label: '管理员设置', icon: Shield },
] as const;

export default function ManageTabs() {
  const pathname = usePathname();

  return (
    <div className='flex justify-center mb-6'>
      <div className='inline-flex items-center gap-1 p-1 rounded-full bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700'>
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                active
                  ? 'bg-green-600 text-white shadow'
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
  );
}
