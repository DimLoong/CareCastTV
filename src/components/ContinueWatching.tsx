/* eslint-disable no-console */
'use client';

import { useEffect, useState } from 'react';

import type { PlayRecord } from '@/lib/db.client';
import {
  clearAllPlayRecords,
  deletePlayRecordsBatch,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { useMultiSelect } from '@/hooks/useMultiSelect';

import ScrollableRow from '@/components/ScrollableRow';
import SelectableCard from '@/components/SelectableCard';
import SelectionToolbar from '@/components/SelectionToolbar';
import VideoCard from '@/components/VideoCard';

interface ContinueWatchingProps {
  className?: string;
}

export default function ContinueWatching({ className }: ContinueWatchingProps) {
  const [playRecords, setPlayRecords] = useState<
    (PlayRecord & { key: string })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const CONTINUE_WATCHING_LIMIT = 24;
  const visiblePlayRecords = playRecords.slice(0, CONTINUE_WATCHING_LIMIT);
  const select = useMultiSelect(visiblePlayRecords.map((r) => r.key));

  // 处理播放记录数据更新的函数
  const updatePlayRecords = (allRecords: Record<string, PlayRecord>) => {
    // 将记录转换为数组并根据 save_time 由近到远排序
    const recordsArray = Object.entries(allRecords).map(([key, record]) => ({
      ...record,
      key,
    }));

    // 按 save_time 降序排序（最新的在前面）
    const sortedRecords = recordsArray.sort(
      (a, b) => b.save_time - a.save_time,
    );

    setPlayRecords(sortedRecords);
  };

  useEffect(() => {
    const fetchPlayRecords = async () => {
      try {
        setLoading(true);

        // 从缓存或API获取所有播放记录
        const allRecords = await getAllPlayRecords();
        updatePlayRecords(allRecords);
      } catch (error) {
        console.error('获取播放记录失败:', error);
        setPlayRecords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayRecords();

    // 监听播放记录更新事件
    const unsubscribe = subscribeToDataUpdates(
      'playRecordsUpdated',
      (newRecords: Record<string, PlayRecord>) => {
        updatePlayRecords(newRecords);
      },
    );

    return unsubscribe;
  }, []);

  // 如果没有播放记录，则不渲染组件
  if (!loading && playRecords.length === 0) {
    return null;
  }

  // 计算播放进度百分比
  const getProgress = (record: PlayRecord) => {
    if (record.total_time === 0) return 0;
    return (record.play_time / record.total_time) * 100;
  };

  // 从 key 中解析 source 和 id
  const parseKey = (key: string) => {
    const [source, id] = key.split('+');
    return { source, id };
  };

  const handleDeleteSelected = async () => {
    setDeleting(true);
    try {
      await deletePlayRecordsBatch(
        Array.from(select.selected).map((key) => parseKey(key)),
      );
      select.exit();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className={`mb-8 ${className || ''}`}>
      <SelectionToolbar
        title='继续观看'
        itemCount={!loading ? playRecords.length : 0}
        selectionMode={select.selectionMode}
        selectedCount={select.selected.size}
        allSelected={select.allSelected}
        deleting={deleting}
        onEnterSelection={select.enter}
        onExitSelection={select.exit}
        onToggleSelectAll={select.toggleSelectAll}
        onDeleteSelected={handleDeleteSelected}
        onClearAll={async () => {
          await clearAllPlayRecords();
          setPlayRecords([]);
        }}
      />
      <ScrollableRow>
        {loading
          ? // 加载状态显示灰色占位数据
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className='min-w-24 w-24 sm:min-w-45 sm:w-44'>
                <div className='relative aspect-2/3 w-full overflow-hidden rounded-lg bg-gray-200 animate-pulse dark:bg-gray-800'>
                  <div className='absolute inset-0 bg-gray-300 dark:bg-gray-700'></div>
                </div>
                <div className='mt-2 h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-800'></div>
                <div className='mt-1 h-3 bg-gray-200 rounded animate-pulse dark:bg-gray-800'></div>
              </div>
            ))
          : // 显示真实数据
            visiblePlayRecords.map((record) => {
              const { source, id } = parseKey(record.key);
              return (
                <div
                  key={record.key}
                  className='min-w-24 w-24 sm:min-w-45 sm:w-44'
                >
                  <SelectableCard
                    selectionMode={select.selectionMode}
                    selected={select.selected.has(record.key)}
                    onToggle={() => select.toggle(record.key)}
                  >
                    <VideoCard
                      id={id}
                      title={record.title}
                      poster={record.cover}
                      year={record.year}
                      source={source}
                      source_name={record.source_name}
                      progress={getProgress(record)}
                      episodes={record.total_episodes}
                      currentEpisode={record.index}
                      query={record.search_title}
                      from='playrecord'
                      onDelete={() =>
                        setPlayRecords((prev) =>
                          prev.filter((r) => r.key !== record.key),
                        )
                      }
                      type={record.total_episodes > 1 ? 'tv' : ''}
                    />
                  </SelectableCard>
                </div>
              );
            })}
      </ScrollableRow>
    </section>
  );
}
