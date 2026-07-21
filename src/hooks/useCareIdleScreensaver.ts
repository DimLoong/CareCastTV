/**
 * 防烧屏空闲遮罩（关怀模式）
 *
 * 停播提示屏或家人手动暂停后，画面长时间静止会有电视烧屏风险。
 * 当 active=true（关怀模式且播放器处于暂停/已停播状态）且超过 idleSeconds
 * 无任何操作，返回 true；调用方应渲染近乎纯黑、仅带极淡文字的遮罩，
 * 且必须以整个应用的最高层级 + 全屏事件拦截渲染（本 hook 已在捕获阶段
 * 拦截所有输入），确保无论底层播放器处于何种状态都不可被误触发操作。
 * 任意按键/点击可"解锁"（只是消隐遮罩本身，不会误触发底层播放器）。
 *
 * 维护者：DimLoong
 */
'use client';

import { useEffect, useRef, useState } from 'react';

const CHECK_INTERVAL_MS = 1000;
const DEFAULT_IDLE_SECONDS = 180;

export function useCareIdleScreensaver(
  active: boolean,
  idleSeconds: number = DEFAULT_IDLE_SECONDS,
): boolean {
  const [dimmed, setDimmed] = useState(false);
  const dimmedRef = useRef(false);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    dimmedRef.current = dimmed;
  }, [dimmed]);

  useEffect(() => {
    if (!active) {
      setDimmed(false);
      return;
    }

    lastActivityRef.current = Date.now();
    const idleMs = Math.max(1, idleSeconds) * 1000;

    // 捕获阶段拦截：遮罩激活时的第一次按键/点击只用来解锁遮罩，
    // 不能穿透到底层播放器（避免误触发跳转/音量等操作）。
    // 监听挂在 window 且 capture=true，早于 document/目标元素上的任何
    // 监听器（包括播放器自身的快捷键处理），从事件分发源头就完全拦截。
    const wake = (e: Event) => {
      if (dimmedRef.current) {
        e.preventDefault();
        e.stopPropagation();
        setDimmed(false);
      }
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('keydown', wake, true);
    window.addEventListener('pointerdown', wake, true);
    window.addEventListener('touchstart', wake, true);
    window.addEventListener('wheel', wake, true);

    const timer = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= idleMs) {
        setDimmed(true);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener('keydown', wake, true);
      window.removeEventListener('pointerdown', wake, true);
      window.removeEventListener('touchstart', wake, true);
      window.removeEventListener('wheel', wake, true);
      clearInterval(timer);
    };
  }, [active, idleSeconds]);

  return dimmed;
}
