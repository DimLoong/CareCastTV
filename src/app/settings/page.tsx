/**
 * 管理 → 本地设置 页面
 *
 * 原 DecoTV 把本地设置塞在用户头像弹出面板里，CareCastTV 将其升级为独立页面，
 * 与 关怀管理 / 管理员设置 组成「管理」区域（电视端左右结构：左 tab / 右内容）。
 *
 * 维护者：DimLoong
 */
'use client';

import LocalSettingsPanel from '@/components/LocalSettingsPanel';
import ManageLayout from '@/components/ManageLayout';
import PageLayout from '@/components/PageLayout';

export default function SettingsPage() {
  return (
    <PageLayout activePath='/settings'>
      <div className='max-w-6xl mx-auto px-4 py-8'>
        <ManageLayout>
          <header className='mb-6'>
            <h1 className='text-2xl font-bold brand-gradient-text inline-block'>
              本地设置
            </h1>
            <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
              仅影响当前浏览器/设备的偏好设置
            </p>
          </header>
          <LocalSettingsPanel />
        </ManageLayout>
      </div>
    </PageLayout>
  );
}
