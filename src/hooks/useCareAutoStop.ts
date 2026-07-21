/**
 * 定时停止播放（护眼）
 *
 * 关怀模式下，家属可配置两种停播方式：
 * - 按连续播放时长：从进入播放页开始累计（sessionStorage 记录会话起点，
 *   退出关怀模式或关闭浏览器标签页会重置），达到设定分钟数后停止，
 *   停止后进入冷却期（护眼提示屏显示倒计时），冷却结束自动恢复播放并重新计时——
 *   零操作，符合本项目"打开就能看"的定位，不是惩罚性锁定
 * - 按每日固定北京时间：每天到达设定时刻后停止（如 22:00 后不再播放），
 *   这是当天的终止时间，不设冷却自动恢复，需退出关怀模式（算术验证）才能继续
 *
 * 维护者：DimLoong
 */
'use client';

import { useEffect, useRef, useState } from 'react';

import {
  getPlaybackSessionStart,
  resetPlaybackSession,
} from '@/lib/carecast.client';
import { CareAutoStopConfig } from '@/lib/carecast.types';

export interface CareAutoStopState {
  triggered: boolean;
  reason: 'duration' | 'dailyTime' | null;
  /** 冷却剩余秒数（仅 duration 模式停播后有值，用于护眼提示屏倒计时展示） */
  cooldownRemainingSeconds: number | null;
  /** 每次冷却结束自动恢复播放时递增，播放页可据此触发一次 play() 尝试 */
  autoResumeTick: number;
}

const CHECK_INTERVAL_MS = 1000;
/** 记录本次触发停播的时间点，供冷却倒计时跨组件重渲染/短暂重挂载保持连续 */
const TRIGGERED_AT_KEY = 'carecast_autostop_triggered_at';

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
    cooldownRemainingSeconds: null,
    autoResumeTick: 0,
  });
  const sessionStartRef = useRef<number | null>(null);

  const enabled = active && !!config?.enabled;
  const mode = config?.mode;
  const maxContinuousMinutes = config?.maxContinuousMinutes;
  const cooldownMinutes = config?.cooldownMinutes;
  const dailyStopTime = config?.dailyStopTime;

  useEffect(() => {
    if (!enabled || !mode) return;

    sessionStartRef.current = getPlaybackSessionStart();

    const check = () => {
      // duration 模式：已处于冷却期，只需推进倒计时 / 判断是否该自动恢复
      const triggeredAtRaw = sessionStorage.getItem(TRIGGERED_AT_KEY);
      if (mode === 'duration' && triggeredAtRaw) {
        const triggeredAt = parseInt(triggeredAtRaw, 10);
        const cooldownMs = (cooldownMinutes ?? 15) * 60000;
        const remainingMs = triggeredAt + cooldownMs - Date.now();
        if (remainingMs <= 0) {
          // 冷却结束：自动恢复，重新开始计时
          sessionStorage.removeItem(TRIGGERED_AT_KEY);
          resetPlaybackSession();
          sessionStartRef.current = getPlaybackSessionStart();
          setState((prev) => ({
            triggered: false,
            reason: null,
            cooldownRemainingSeconds: null,
            autoResumeTick: prev.autoResumeTick + 1,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            triggered: true,
            reason: 'duration',
            cooldownRemainingSeconds: Math.ceil(remainingMs / 1000),
          }));
        }
        return;
      }

      if (mode === 'duration' && maxContinuousMinutes) {
        const elapsedMinutes =
          (Date.now() - (sessionStartRef.current ?? Date.now())) / 60000;
        if (elapsedMinutes >= maxContinuousMinutes) {
          sessionStorage.setItem(TRIGGERED_AT_KEY, String(Date.now()));
          setState((prev) => ({
            ...prev,
            triggered: true,
            reason: 'duration',
            cooldownRemainingSeconds: (cooldownMinutes ?? 15) * 60,
          }));
        }
      } else if (mode === 'dailyTime' && dailyStopTime) {
        const now = getBeijingTimeHHMM();
        if (now && now >= dailyStopTime) {
          setState((prev) => ({
            ...prev,
            triggered: true,
            reason: 'dailyTime',
            cooldownRemainingSeconds: null,
          }));
        }
      }
    };

    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled, mode, maxContinuousMinutes, cooldownMinutes, dailyStopTime]);

  return state;
}
