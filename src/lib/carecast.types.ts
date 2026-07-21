/**
 * CareCastTV 核心数据结构
 *
 * 三块核心数据：
 * 1. CareConfig      —— 关怀模式策略（倒计时、验证超时、连播开关、远程配置源）
 * 2. CarePlaylist    —— 跨剧顺序播放队列（播完一部自动播下一部）
 * 3. CareRemoteFile  —— 远程配置文件（托管在 GitHub 仓库中的 JSON，老人端轮询拉取）
 *
 * 维护者：DimLoong
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// 播放列表
// ---------------------------------------------------------------------------

/** 播放列表中的一项 = 一部剧/一部电影（由 source + vodId 唯一定位） */
export interface CarePlaylistItem {
  /** 列表项唯一 id（本地生成） */
  id: string;
  /** 播放源 key（对应 AdminConfig.SourceConfig 里的 key） */
  source: string;
  /** 该源内的视频 id */
  vodId: string;
  title: string;
  /** 换源搜索时使用的标题（沿用 CareCastTV play 页的 stitle 语义） */
  searchTitle?: string;
  cover?: string;
  year?: string;
  sourceName?: string;
  totalEpisodes?: number;
}

/** 跨剧顺序播放队列 */
export interface CarePlaylist {
  items: CarePlaylistItem[];
  /** 当前播放到哪一项（null 表示从第一项开始） */
  currentItemId: string | null;
  /** 播完最后一部后是否回到第一部循环 */
  loop: boolean;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// 关怀模式配置
// ---------------------------------------------------------------------------

/** 远程配置源（GitHub 仓库中的 JSON 文件） */
export interface CareRemoteSource {
  enabled: boolean;
  /**
   * 配置文件地址。支持：
   * - raw 地址：https://raw.githubusercontent.com/user/repo/main/carecast.json
   * - github blob 地址（会自动转换为 raw）
   * - gist raw 地址
   */
  url: string;
  /** 轮询间隔（秒），默认 60 */
  pollIntervalSeconds: number;
  /** 私有仓库的 GitHub token（可选） */
  token?: string;
}

/**
 * 定时停止播放（护眼）：
 * - 'duration'：连续观看达到指定分钟数后停止（从进入播放页开始累计，退出关怀模式会重置计时）
 * - 'dailyTime'：每天到达指定的北京时间后停止（如晚上 22:00 后不再播放）
 */
export interface CareAutoStopConfig {
  enabled: boolean;
  mode: 'duration' | 'dailyTime';
  /** 连续播放多少分钟后停止（mode='duration' 时生效） */
  maxContinuousMinutes: number;
  /** 每天几点后停止播放，北京时间 "HH:mm"（mode='dailyTime' 时生效） */
  dailyStopTime: string;
}

export interface CareConfig {
  /** 是否启用关怀模式（启用后应用被门禁在 /care 老人视图内） */
  careModeEnabled: boolean;
  /** 关怀主页自动续播倒计时（秒） */
  countdownSeconds: number;
  /** 退出验证页无操作自动回退时间（秒） */
  verifyTimeoutSeconds: number;
  /** 单部剧播完后是否自动播放播放列表中的下一部 */
  autoAdvance: boolean;
  /** 定时停止播放（护眼），见 {@link CareAutoStopConfig} */
  autoStop: CareAutoStopConfig;
  remote: CareRemoteSource;
  updatedAt: number;
}

export const DEFAULT_CARE_CONFIG: CareConfig = {
  careModeEnabled: false,
  countdownSeconds: 5,
  verifyTimeoutSeconds: 30,
  autoAdvance: true,
  autoStop: {
    enabled: false,
    mode: 'duration',
    maxContinuousMinutes: 60,
    dailyStopTime: '22:00',
  },
  remote: {
    enabled: false,
    url: '',
    pollIntervalSeconds: 60,
  },
  updatedAt: 0,
};

// ---------------------------------------------------------------------------
// 续播目标（关怀主页"继续播放"解析结果）
// ---------------------------------------------------------------------------

export interface CareResumeTarget {
  source: string;
  vodId: string;
  title: string;
  searchTitle?: string;
  year?: string;
  cover?: string;
  /** 第几集（1 基），undefined 表示由播放页按播放记录自行恢复 */
  episodeIndex?: number;
  /** 集内进度（秒），仅用于展示 */
  playTimeSeconds?: number;
  totalEpisodes?: number;
}

// ---------------------------------------------------------------------------
// 远程配置文件 schema（GitHub 上的 carecast.json）
// ---------------------------------------------------------------------------

const remotePlaylistItemSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  vodId: z.string().min(1),
  title: z.string().min(1),
  searchTitle: z.string().optional(),
  cover: z.string().optional(),
  year: z.string().optional(),
  sourceName: z.string().optional(),
  totalEpisodes: z.number().int().positive().optional(),
});

/**
 * 远程配置文件结构。所有字段均可选，按需下发：
 * - version：递增版本号。只有比本地已应用版本大才会被应用（防止重复/回滚）
 * - config：覆盖本地策略
 * - playlist：覆盖本地播放列表
 * - command：一次性指令（如 playNow 远程点播），按 id 去重
 */
export const careRemoteFileSchema = z.object({
  version: z.number().int().nonnegative(),
  config: z
    .object({
      careModeEnabled: z.boolean().optional(),
      countdownSeconds: z.number().int().min(0).max(600).optional(),
      verifyTimeoutSeconds: z.number().int().min(5).max(600).optional(),
      autoAdvance: z.boolean().optional(),
      autoStop: z
        .object({
          enabled: z.boolean().optional(),
          mode: z.enum(['duration', 'dailyTime']).optional(),
          maxContinuousMinutes: z.number().int().min(5).max(1440).optional(),
          dailyStopTime: z
            .string()
            .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
            .optional(),
        })
        .optional(),
    })
    .optional(),
  playlist: z
    .object({
      items: z.array(remotePlaylistItemSchema),
      currentItemId: z.string().nullable().optional(),
      loop: z.boolean().optional(),
    })
    .optional(),
  command: z
    .object({
      id: z.string().min(1),
      type: z.literal('playNow'),
      source: z.string().min(1),
      vodId: z.string().min(1),
      title: z.string().optional(),
      searchTitle: z.string().optional(),
      /** 第几集（1 基），不传则从播放记录/第一集开始 */
      episode: z.number().int().positive().optional(),
    })
    .optional(),
});

export type CareRemoteFile = z.infer<typeof careRemoteFileSchema>;

/** 本地记录的远程配置应用状态（用于版本去重与指令去重） */
export interface CareRemoteState {
  lastAppliedVersion: number;
  lastCommandId: string | null;
  lastFetchAt: number;
  lastError: string | null;
}
