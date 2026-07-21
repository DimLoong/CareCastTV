/**
 * 多选选中状态管理（首页 继续观看/收藏夹/最近浏览 三个 tab 共用）
 *
 * 只负责"选中了哪些 key"这件事本身；具体的删除/清空逻辑由调用方决定
 * （不同 tab 对应不同的数据源与删除 API）。
 *
 * 维护者：DimLoong
 */
'use client';

import { useCallback, useMemo, useState } from 'react';

export function useMultiSelect(allKeys: string[]) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(allKeys));
  }, [allKeys]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const enter = useCallback(() => {
    setSelectionMode(true);
  }, []);

  const exit = useCallback(() => {
    setSelectionMode(false);
    setSelected(new Set());
  }, []);

  const allSelected = useMemo(
    () => allKeys.length > 0 && selected.size === allKeys.length,
    [allKeys, selected],
  );

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAll();
    }
  }, [allSelected, clearSelection, selectAll]);

  return {
    selectionMode,
    selected,
    enter,
    exit,
    toggle,
    toggleSelectAll,
    allSelected,
  };
}
