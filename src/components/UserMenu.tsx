/**
 * 用户菜单（精简版）
 *
 * 头像点击后的面板只保留：当前用户信息 + 退出登录。
 * 原来塞在这里的「本地设置 / 管理面板 / 修改密码 / 下载管理 / 版本信息」
 * 已迁移到 管理 → 本地设置（/settings）与 管理员设置（/admin）标签页。
 *
 * 维护者：DimLoong
 */
'use client';

import { LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

interface AuthInfo {
  username?: string;
  role?: 'owner' | 'admin' | 'user';
}

export const UserMenu: React.FC = () => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [authInfo, setAuthInfo] = useState<AuthInfo | null>(null);
  const [storageType, setStorageType] = useState<string>('localstorage');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      setAuthInfo(getAuthInfoFromBrowserCookie());
      setStorageType(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).RUNTIME_CONFIG?.STORAGE_TYPE || 'localstorage',
      );
    }
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch {
      // 即使接口失败也跳转登录页
    }
    setIsOpen(false);
    router.push('/login');
  };

  // 角色中文映射
  const getRoleText = (role?: string) => {
    switch (role) {
      case 'owner':
        return '站长';
      case 'admin':
        return '管理员';
      case 'user':
        return '用户';
      default:
        return '';
    }
  };

  const menuPanel = (
    <>
      {/* 背景遮罩 */}
      <div
        className='fixed inset-0 bg-transparent z-1000'
        onClick={() => setIsOpen(false)}
      />

      {/* 菜单面板 */}
      <div className='fixed top-2 right-2 w-56 bg-white dark:bg-gray-900 rounded-lg shadow-2xl z-1001 border border-slate-200 dark:border-gray-700/50 overflow-hidden select-none'>
        {/* 用户信息区域 */}
        <div className='px-3 py-2.5 border-b border-slate-200 dark:border-gray-700 bg-linear-to-r from-slate-50 to-slate-100 dark:from-gray-800 dark:to-gray-800/50'>
          <div className='space-y-1'>
            <div className='flex items-center justify-between'>
              <span className='text-xs font-medium text-slate-600 dark:text-gray-400 uppercase tracking-wider'>
                当前用户
              </span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                  (authInfo?.role || 'user') === 'owner'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                    : (authInfo?.role || 'user') === 'admin'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                }`}
              >
                {getRoleText(authInfo?.role || 'user')}
              </span>
            </div>
            <div className='flex items-center justify-between'>
              <div className='font-semibold text-slate-900 dark:text-gray-100 text-sm truncate'>
                {authInfo?.username || 'default'}
              </div>
              <div className='text-[10px] text-slate-500 dark:text-gray-500'>
                数据存储：
                {storageType === 'localstorage' ? '本地' : storageType}
              </div>
            </div>
          </div>
        </div>

        {/* 唯一操作：退出登录 */}
        <div className='py-1'>
          <button
            onClick={handleLogout}
            className='w-full px-3 py-2 text-left flex items-center gap-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm'
          >
            <LogOut className='w-4 h-4' />
            <span className='font-medium'>退出登录</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='w-10 h-10 p-2 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors'
        aria-label='User Menu'
      >
        <User className='w-full h-full' />
      </button>

      {isOpen && mounted && createPortal(menuPanel, document.body)}
    </>
  );
};
