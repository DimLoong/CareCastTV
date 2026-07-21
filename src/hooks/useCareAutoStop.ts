/**
 * 定时停止播放（护眼）
 *
 * 关怀模式下，家属可配置两种停播方式：
 * - 按连续播放时长：从进入播放页开始累计（sessionStorage 记录会话起点，
 *   退出关怀模式或关闭浏览器标签页会重置），达到设定分钟数后停止
 * - 按每日固定北京时间：每天到达设定时刻后停止（如 22:00 后不再播放）
 *
 * 触发后 triggered 保持为 true，不提供"继续播放"按钮——
 * 唯一的恢复方式是退出关怀模式（算术验证），这是刻意设计，
 * 避免停播提示形同虚设。
 *
 * 维护者：DimLoong
 */
'use client';

import { useEffect, useRef, useState } from 'react';

import { getPlaybackSessionStart } from '@/lib/carecast.client';
import { CareAutoStopConfig } from '@/lib/carecast.types';

export interface CareAutoStopState {
  triggered: boolean;
  reason: 'duration' | 'dailyTime' | null;
}

const CHECK_INTERVAL_MS = 15000;

/** 获取当前北京时间 "HH:mm"，用于和 dailyStopTime 做字符串比较 */
function getBeijingTimeHHMM(): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch {
    return '';
  }
}

export function useCareAutoStop(
  active: boolean,
  config: CareAutoStopConfig | undefined,
): CareAutoStopState {
  const [state, setState] = useState<CareAutoStopState>({
    triggered: false,
    reason: null,
  });
  const sessionStartRef = useRef<number | null>(null);

  const enabled = active && !!config?.enabled;
  const mode = config?.mode;
  const maxContinuousMinutes = config?.maxContinuousMinutes;
  const dailyStopTime = config?.dailyStopTime;

  useEffect(() => {
    if (!enabled || !mode) return;

    sessionStartRef.current = getPlaybackSessionStart();

    const check = () => {
      if (mode === 'duration' && maxContinuousMinutes) {
        const elapsedMinutes =
          (Date.now() - (sessionStartRef.current ?? Date.now())) / 60000;
        if (elapsedMinutes >= maxContinuousMinutes) {
          setState({ triggered: true, reason: 'duration' });
        }
      } else if (mode === 'dailyTime' && dailyStopTime) {
        const now = getBeijingTimeHHMM();
        if (now && now >= dailyStopTime) {
          setState({ triggered: true, reason: 'dailyTime' });
        }
      }
    };

    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled, mode, maxContinuousMinutes, dailyStopTime]);

  return state;
}
