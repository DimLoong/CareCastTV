/**
 * 全局输入拦截（关怀模式停播提示屏专用）
 *
 * 停播提示屏必须让底层播放器"无法操作"——不仅要盖住画面，还要在事件层面
 * 彻底截断，防止播放器控件因为层级问题（如 ArtPlayer 的 web 全屏 CSS 层级
 * 高于普通遮罩、或用户此前进入了浏览器原生全屏）而仍可被点击/按键操作。
 *
 * 监听挂在 window 且 capture=true，早于 document 与目标元素上的任何监听器
 * （包括播放器自身绑定的快捷键/点击处理），从事件分发的最源头拦截，
 * 不依赖 CSS 层叠上下文。exemptRef 指向遮罩自身的 DOM 容器，
 * 落在其内部的交互（如"退出关怀模式"按钮）正常放行。
 *
 * 维护者：DimLoong
 */
'use client';

import { RefObject, useEffect } from 'react';

export function useCareInputBlocker(
  active: boolean,
  exemptRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active) return;

    const block = (e: Event) => {
      const target = e.target as Node | null;
      if (exemptRef.current && target && exemptRef.current.contains(target)) {
        return; // 遮罩自身的交互（退出按钮等）正常放行
      }
      e.preventDefault();
      e.stopPropagation();
    };

    const events: Array<
      'keydown' | 'keyup' | 'pointerdown' | 'mousedown' | 'touchstart' | 'wheel' | 'contextmenu'
    > = [
      'keydown',
      'keyup',
      'pointerdown',
      'mousedown',
      'touchstart',
      'wheel',
      'contextmenu',
    ];
    events.forEach((type) => window.addEventListener(type, block, true));
    return () => {
      events.forEach((type) => window.removeEventListener(type, block, true));
    };
  }, [active, exemptRef]);
}
