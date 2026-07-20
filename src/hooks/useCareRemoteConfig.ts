/**
 * 远程配置轮询 Hook
 *
 * 在关怀模式相关页面挂载后，按配置的间隔轮询 GitHub 上的 carecast.json：
 * - 有新版本（version 更大）时应用配置/播放列表
 * - 有新 playNow 指令时立即跳转播放（远程点播）
 *
 * 维护者：DimLoong
 */
'use client';

import { useCallback, useEffect, useRef } from 'react';

import {
  applyRemoteConfigFile,
  buildCarePlayUrl,
  getCareConfig,
  recordRemoteFetchError,
} from '@/lib/carecast.client';
import { CareRemoteFile, careRemoteFileSchema } from '@/lib/carecast.types';

/** 手动拉取一次远程配置（管理员页"立即拉取"也用它） */
export async function fetchRemoteConfigOnce(
  url: string,
  token?: string,
): Promise<CareRemoteFile> {
  const res = await fetch(
    `/api/carecast/remote?url=${encodeURIComponent(url)}`,
    {
      headers: token ? { 'x-care-token': token } : undefined,
      cache: 'no-store',
    },
  );
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error || `请求失败 (${res.status})`);
  }
  // 服务端已校验过，这里再 parse 一次保证类型安全
  return careRemoteFileSchema.parse(body.data);
}

/**
 * @param enabled 是否启用轮询（通常 = 关怀模式开启中）
 */
export function useCareRemoteConfig(enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 防止组件卸载后仍执行跳转
  const activeRef = useRef(true);

  const pollOnce = useCallback(async () => {
    const config = getCareConfig();
    if (!config.remote.enabled || !config.remote.url) return;

    try {
      const file = await fetchRemoteConfigOnce(
        config.remote.url,
        config.remote.token,
      );
      const result = applyRemoteConfigFile(file);

      // 远程点播：立即切换到指定内容播放
      if (result.playNow && activeRef.current) {
        const cmd = result.playNow;
        // 整页跳转而非 router.push：播放页初始化依赖挂载期 effect，
        // 整页导航保证状态完全重置
        window.location.href = buildCarePlayUrl({
          source: cmd.source,
          vodId: cmd.vodId,
          title: cmd.title,
          searchTitle: cmd.searchTitle,
        });
      }
    } catch (err) {
      recordRemoteFetchError(err instanceof Error ? err.message : '未知错误');
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    if (!enabled) return;

    let cancelled = false;

    const loop = async () => {
      if (cancelled) return;
      await pollOnce();
      if (cancelled) return;
      // 每轮结束后重新读取间隔，远程下发的新间隔即时生效
      const intervalSec = Math.max(
        10,
        getCareConfig().remote.pollIntervalSeconds || 60,
      );
      timerRef.current = setTimeout(loop, intervalSec * 1000);
    };

    loop();

    return () => {
      cancelled = true;
      activeRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, pollOnce]);
}
