/**
 * 多选卡片包装（首页 继续观看/收藏夹/最近浏览 三个 tab 共用）
 *
 * 多选模式下，在卡片上叠加一层透明遮罩拦截点击（避免误触发 VideoCard
 * 自身的跳转播放），左上角显示圆形勾选标记；非多选模式下原样透传点击。
 *
 * 维护者：DimLoong
 */
'use client';

import { Check } from 'lucide-react';
import { ReactNode } from 'react';

interface SelectableCardProps {
  selectionMode: boolean;
  selected: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export default function SelectableCard({
  selectionMode,
  selected,
  onToggle,
  children,
}: SelectableCardProps) {
  return (
    <div className='relative'>
      {selectionMode && (
        <div
          className='absolute inset-0 z-10 cursor-pointer rounded-lg'
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          }}
        >
          <div
            className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
              selected
                ? 'brand-gradient-bg border-transparent'
                : 'bg-black/40 border-white/80'
            }`}
          >
            {selected && <Check className='w-4 h-4 text-white' />}
          </div>
          {selected && (
            <div className='absolute inset-0 rounded-lg ring-2 ring-[color:var(--brand-color)]' />
          )}
        </div>
      )}
      {children}
    </div>
  );
}
