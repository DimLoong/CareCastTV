/**
 * 本地设置面板（页面内嵌版）
 *
 * 原 DecoTV 把这些设置塞在用户头像的弹出面板里，CareCastTV 将其迁移为
 * 「管理 → 本地设置」标签页的正式页面内容。设置项与原实现一致：
 * 豆瓣数据/图片代理、聚合搜索、优选测速、流式搜索、播放缓冲模式，
 * 外加下载管理入口、修改密码（数据库模式的非站长用户）与版本信息。
 *
 * 所有设置仍保存在本地浏览器 localStorage 中，键名与原实现保持兼容。
 *
 * 维护者：DimLoong
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

'use client';

import {
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  Info,
  KeyRound,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { CURRENT_VERSION } from '@/lib/version';

import { useDownloadManager } from '@/contexts/DownloadManagerContext';

import { VersionPanel } from './VersionPanel';

// 播放缓冲模式选项
const bufferModeOptions = [
  {
    value: 'standard' as const,
    label: '默认模式',
    description: '标准缓冲设置，适合网络稳定的环境',
    icon: '🎯',
  },
  {
    value: 'enhanced' as const,
    label: '增强模式',
    description: '1.5倍缓冲，适合偶尔卡顿的网络环境',
    icon: '⚡',
  },
  {
    value: 'max' as const,
    label: '强力模式',
    description: '3倍大缓冲，起播稍慢但播放更流畅',
    icon: '🚀',
  },
];

// 豆瓣数据源选项
const doubanDataSourceOptions = [
  { value: 'direct', label: '直连（服务器直接请求豆瓣）' },
  { value: 'cors-proxy-zwei', label: 'Cors Proxy By Zwei' },
  { value: 'cmliussss-cdn-tencent', label: '豆瓣 CDN By CMLiussss（腾讯云）' },
  { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）' },
  { value: 'custom', label: '自定义代理' },
];

// 豆瓣图片代理选项
const doubanImageProxyTypeOptions = [
  { value: 'direct', label: '直连（浏览器直接请求豆瓣）' },
  { value: 'server', label: '服务器代理（由服务器代理请求豆瓣）' },
  { value: 'img3', label: '豆瓣官方精品 CDN（阿里云）' },
  { value: 'cmliussss-cdn-tencent', label: '豆瓣 CDN By CMLiussss（腾讯云）' },
  { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）' },
  { value: 'custom', label: '自定义代理' },
];

// 数据源感谢信息
function getThanksInfo(dataSource: string) {
  switch (dataSource) {
    case 'cors-proxy-zwei':
      return { text: 'Thanks to @Zwei', url: 'https://github.com/bestzwei' };
    case 'cmliussss-cdn-tencent':
    case 'cmliussss-cdn-ali':
      return { text: 'Thanks to @CMLiussss', url: 'https://github.com/cmliu' };
    default:
      return null;
  }
}

/** 开关组件（沿用原设置面板样式） */
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className='flex items-center cursor-pointer'>
      <div className='relative'>
        <input
          type='checkbox'
          className='sr-only peer'
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className='w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
        <div className='absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5'></div>
      </div>
    </label>
  );
}

/** 自定义下拉选择框（沿用原设置面板样式） */
function Dropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className='relative'>
      <button
        type='button'
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className='w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm text-left'
      >
        {options.find((o) => o.value === value)?.label}
      </button>
      <div className='absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none'>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>
      {open && (
        <div className='absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto'>
          {options.map((option) => (
            <button
              key={option.value}
              type='button'
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`w-full px-3 py-2.5 text-left text-sm transition-colors flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 ${
                value === option.value
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                  : 'text-gray-900 dark:text-gray-100'
              }`}
            >
              <span className='truncate'>{option.label}</span>
              {value === option.value && (
                <Check className='w-4 h-4 text-green-600 shrink-0 ml-2' />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LocalSettingsPanel() {
  const router = useRouter();
  const { openManager } = useDownloadManager();

  // 设置状态
  const [defaultAggregateSearch, setDefaultAggregateSearch] = useState(true);
  const [enableOptimization, setEnableOptimization] = useState(true);
  const [fluidSearch, setFluidSearch] = useState(true);
  const [playerBufferMode, setPlayerBufferMode] = useState<
    'standard' | 'enhanced' | 'max'
  >('standard');
  const [doubanDataSource, setDoubanDataSource] = useState(
    'cmliussss-cdn-tencent',
  );
  const [doubanProxyUrl, setDoubanProxyUrl] = useState('');
  const [doubanImageProxyType, setDoubanImageProxyType] = useState(
    'cmliussss-cdn-tencent',
  );
  const [doubanImageProxyUrl, setDoubanImageProxyUrl] = useState('');

  // 修改密码状态（仅数据库模式的非站长用户可见）
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const [isVersionPanelOpen, setIsVersionPanelOpen] = useState(false);

  // 从 localStorage / 运行时配置恢复设置（键名与原 UserMenu 实现兼容）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rc = (window as any).RUNTIME_CONFIG || {};

    const saved = (key: string) => localStorage.getItem(key);

    const aggregate = saved('defaultAggregateSearch');
    if (aggregate !== null) setDefaultAggregateSearch(JSON.parse(aggregate));

    const optimization = saved('enableOptimization');
    if (optimization !== null) setEnableOptimization(JSON.parse(optimization));

    const fluid = saved('fluidSearch');
    if (fluid !== null) setFluidSearch(JSON.parse(fluid));
    else setFluidSearch(rc.FLUID_SEARCH !== false);

    const buffer = saved('playerBufferMode');
    if (buffer === 'standard' || buffer === 'enhanced' || buffer === 'max') {
      setPlayerBufferMode(buffer);
    }

    setDoubanDataSource(
      saved('doubanDataSource') ||
        rc.DOUBAN_PROXY_TYPE ||
        'cmliussss-cdn-tencent',
    );
    setDoubanProxyUrl(saved('doubanProxyUrl') || rc.DOUBAN_PROXY || '');
    setDoubanImageProxyType(
      saved('doubanImageProxyType') ||
        rc.DOUBAN_IMAGE_PROXY_TYPE ||
        'cmliussss-cdn-tencent',
    );
    setDoubanImageProxyUrl(
      saved('doubanImageProxyUrl') || rc.DOUBAN_IMAGE_PROXY || '',
    );

    // 是否显示修改密码
    const auth = getAuthInfoFromBrowserCookie();
    const storageType = rc.STORAGE_TYPE || 'localstorage';
    setShowChangePassword(
      auth?.role !== 'owner' && storageType !== 'localstorage',
    );
  }, []);

  // 各设置项写回 localStorage
  const set = (key: string, value: string) => {
    if (typeof window !== 'undefined') localStorage.setItem(key, value);
  };

  const handleResetSettings = () => {
    const rc = (window as any).RUNTIME_CONFIG || {};
    const defaultFluid = rc.FLUID_SEARCH !== false;
    setDefaultAggregateSearch(true);
    setEnableOptimization(true);
    setFluidSearch(defaultFluid);
    setPlayerBufferMode('standard');
    setDoubanDataSource(rc.DOUBAN_PROXY_TYPE || 'cmliussss-cdn-tencent');
    setDoubanProxyUrl(rc.DOUBAN_PROXY || '');
    setDoubanImageProxyType(
      rc.DOUBAN_IMAGE_PROXY_TYPE || 'cmliussss-cdn-tencent',
    );
    setDoubanImageProxyUrl(rc.DOUBAN_IMAGE_PROXY || '');

    set('defaultAggregateSearch', JSON.stringify(true));
    set('enableOptimization', JSON.stringify(true));
    set('fluidSearch', JSON.stringify(defaultFluid));
    set('playerBufferMode', 'standard');
    set('doubanDataSource', rc.DOUBAN_PROXY_TYPE || 'cmliussss-cdn-tencent');
    set('doubanProxyUrl', rc.DOUBAN_PROXY || '');
    set(
      'doubanImageProxyType',
      rc.DOUBAN_IMAGE_PROXY_TYPE || 'cmliussss-cdn-tencent',
    );
    set('doubanImageProxyUrl', rc.DOUBAN_IMAGE_PROXY || '');
  };

  const handleSubmitChangePassword = async () => {
    setPasswordError('');
    if (!newPassword || !confirmPassword) {
      setPasswordError('请填写完整');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的密码不一致');
      return;
    }
    setPasswordLoading(true);
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || '修改密码失败');
        return;
      }
      // 修改成功后登出重新登录
      await fetch('/api/logout', { method: 'POST' });
      router.push('/login');
    } catch {
      setPasswordError('网络错误，请稍后重试');
    } finally {
      setPasswordLoading(false);
    }
  };

  const sectionClass =
    'rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 p-6 space-y-5';

  return (
    <div className='space-y-6'>
      {/* 播放与搜索 */}
      <section className={sectionClass}>
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
            播放与搜索
          </h2>
          <button
            onClick={handleResetSettings}
            className='px-2 py-1 text-xs text-red-500 hover:text-red-700 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors'
            title='重置本页全部设置为默认值'
          >
            恢复默认
          </button>
        </div>

        <div className='flex items-center justify-between'>
          <div>
            <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              默认聚合搜索结果
            </h4>
            <p className='text-xs text-gray-500 mt-1'>
              搜索时默认按标题和年份聚合显示结果
            </p>
          </div>
          <Toggle
            checked={defaultAggregateSearch}
            onChange={(v) => {
              setDefaultAggregateSearch(v);
              set('defaultAggregateSearch', JSON.stringify(v));
            }}
          />
        </div>

        <div className='flex items-center justify-between'>
          <div>
            <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              优选和测速
            </h4>
            <p className='text-xs text-gray-500 mt-1'>
              如出现播放器劫持问题可关闭
            </p>
          </div>
          <Toggle
            checked={enableOptimization}
            onChange={(v) => {
              setEnableOptimization(v);
              set('enableOptimization', JSON.stringify(v));
            }}
          />
        </div>

        <div className='flex items-center justify-between'>
          <div>
            <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              流式搜索输出
            </h4>
            <p className='text-xs text-gray-500 mt-1'>
              启用搜索结果实时流式输出，关闭后使用传统一次性搜索
            </p>
          </div>
          <Toggle
            checked={fluidSearch}
            onChange={(v) => {
              setFluidSearch(v);
              set('fluidSearch', JSON.stringify(v));
            }}
          />
        </div>

        {/* 播放缓冲优化 */}
        <div className='space-y-3'>
          <div>
            <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              播放缓冲优化
            </h4>
            <p className='text-xs text-gray-500 mt-1'>
              根据网络环境选择合适的缓冲模式，减少播放卡顿
            </p>
          </div>
          <div className='space-y-2'>
            {bufferModeOptions.map((option) => {
              const isSelected = playerBufferMode === option.value;
              return (
                <button
                  key={option.value}
                  type='button'
                  onClick={() => {
                    setPlayerBufferMode(option.value);
                    set('playerBufferMode', option.value);
                  }}
                  className={`w-full p-3 rounded-xl border-2 transition-all text-left flex items-center gap-3 ${
                    isSelected
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className='w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-gray-100 dark:bg-gray-700'>
                    {option.icon}
                  </div>
                  <div className='flex-1 min-w-0'>
                    <span
                      className={`font-medium ${
                        isSelected
                          ? 'text-green-700 dark:text-green-300'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {option.label}
                    </span>
                    <p className='text-xs text-gray-400 mt-0.5'>
                      {option.description}
                    </p>
                  </div>
                  {isSelected && <Check className='w-5 h-5 text-green-500' />}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 豆瓣代理 */}
      <section className={sectionClass}>
        <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
          豆瓣数据代理
        </h2>

        <div className='space-y-3'>
          <div>
            <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              豆瓣数据代理
            </h4>
            <p className='text-xs text-gray-500 mt-1'>选择获取豆瓣数据的方式</p>
          </div>
          <Dropdown
            value={doubanDataSource}
            options={doubanDataSourceOptions}
            onChange={(v) => {
              setDoubanDataSource(v);
              set('doubanDataSource', v);
            }}
          />
          {getThanksInfo(doubanDataSource) && (
            <button
              type='button'
              onClick={() =>
                window.open(getThanksInfo(doubanDataSource)!.url, '_blank')
              }
              className='flex items-center justify-center gap-1.5 w-full px-3 text-xs text-gray-500 cursor-pointer'
            >
              <span className='font-medium'>
                {getThanksInfo(doubanDataSource)!.text}
              </span>
              <ExternalLink className='w-3.5 opacity-70' />
            </button>
          )}
        </div>

        {doubanDataSource === 'custom' && (
          <div className='space-y-2'>
            <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              豆瓣代理地址
            </h4>
            <input
              type='text'
              className='w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              placeholder='例如: https://proxy.example.com/fetch?url='
              value={doubanProxyUrl}
              onChange={(e) => {
                setDoubanProxyUrl(e.target.value);
                set('doubanProxyUrl', e.target.value);
              }}
            />
          </div>
        )}

        <div className='space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800'>
          <div>
            <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              豆瓣图片代理
            </h4>
            <p className='text-xs text-gray-500 mt-1'>选择获取豆瓣图片的方式</p>
          </div>
          <Dropdown
            value={doubanImageProxyType}
            options={doubanImageProxyTypeOptions}
            onChange={(v) => {
              setDoubanImageProxyType(v);
              set('doubanImageProxyType', v);
            }}
          />
        </div>

        {doubanImageProxyType === 'custom' && (
          <div className='space-y-2'>
            <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
              豆瓣图片代理地址
            </h4>
            <input
              type='text'
              className='w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              placeholder='例如: https://proxy.example.com/fetch?url='
              value={doubanImageProxyUrl}
              onChange={(e) => {
                setDoubanImageProxyUrl(e.target.value);
                set('doubanImageProxyUrl', e.target.value);
              }}
            />
          </div>
        )}
      </section>

      {/* 其他工具 */}
      <section className={sectionClass}>
        <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
          其他
        </h2>
        <div className='flex flex-wrap gap-3'>
          <button
            onClick={openManager}
            className='flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
          >
            <Download className='w-4 h-4' />
            下载管理
          </button>
          <button
            onClick={() => setIsVersionPanelOpen(true)}
            className='flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
          >
            <Info className='w-4 h-4' />
            版本信息 <span className='font-mono'>v{CURRENT_VERSION}</span>
          </button>
        </div>
        <p className='text-xs text-gray-400'>本页设置保存在本地浏览器中</p>
      </section>

      {/* 修改密码：仅数据库模式的非站长用户 */}
      {showChangePassword && (
        <section className={sectionClass}>
          <h2 className='flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100'>
            <KeyRound className='w-5 h-5' />
            修改密码
          </h2>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <input
              type='password'
              className='w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-800'
              placeholder='新密码'
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={passwordLoading}
            />
            <input
              type='password'
              className='w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-800'
              placeholder='确认新密码'
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={passwordLoading}
            />
          </div>
          {passwordError && (
            <p className='text-sm text-red-500'>{passwordError}</p>
          )}
          <button
            onClick={handleSubmitChangePassword}
            disabled={passwordLoading || !newPassword || !confirmPassword}
            className='px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-medium disabled:opacity-50 transition-colors'
          >
            {passwordLoading ? '修改中…' : '确认修改（修改后需重新登录）'}
          </button>
        </section>
      )}

      <VersionPanel
        isOpen={isVersionPanelOpen}
        onClose={() => setIsVersionPanelOpen(false)}
      />
    </div>
  );
}
