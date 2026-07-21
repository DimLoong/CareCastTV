/**
 * 多选工具栏（首页 继续观看/收藏夹/最近浏览 三个 tab 共用）
 *
 * 非多选模式：标题 + "多选" + "清空"
 * 多选模式：全选/取消全选 + "删除选中 (n)" + "取消"
 *
 * 维护者：DimLoong
 */
'use client';

import { Button } from 'tdesign-react';

interface SelectionToolbarProps {
  title: string;
  itemCount: number;
  selectionMode: boolean;
  selectedCount: number;
  allSelected: boolean;
  deleting?: boolean;
  onEnterSelection: () => void;
  onExitSelection: () => void;
  onToggleSelectAll: () => void;
  onDeleteSelected: () => void;
  onClearAll: () => void;
}

export default function SelectionToolbar({
  title,
  itemCount,
  selectionMode,
  selectedCount,
  allSelected,
  deleting = false,
  onEnterSelection,
  onExitSelection,
  onToggleSelectAll,
  onDeleteSelected,
  onClearAll,
}: SelectionToolbarProps) {
  return (
    <div className='mb-4 flex items-center justify-between gap-2'>
      <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
        {title}
      </h2>
      {itemCount > 0 && (
        <div className='flex items-center gap-2'>
          {selectionMode ? (
            <>
              <Button
                size='small'
                variant='outline'
                theme='default'
                onClick={onToggleSelectAll}
              >
                {allSelected ? '取消全选' : '全选'}
              </Button>
              <Button
                size='small'
                theme='danger'
                loading={deleting}
                disabled={selectedCount === 0}
                onClick={onDeleteSelected}
              >
                删除选中 ({selectedCount})
              </Button>
              <Button
                size='small'
                variant='text'
                theme='default'
                onClick={onExitSelection}
              >
                取消
              </Button>
            </>
          ) : (
            <>
              <Button
                size='small'
                variant='outline'
                theme='default'
                onClick={onEnterSelection}
              >
                多选
              </Button>
              <button
                className='text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                onClick={onClearAll}
              >
                清空
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
