# CareCastTV（护播）

> 面向家庭老人场景的电视 Web 应用：**零操作自动续播 + 防误触 + 可远程控制**。
>
> 基于 Next.js / React / TypeScript 构建。维护者：**DimLoong**

## 产品核心原则

1. 老人不需要任何操作即可持续观看
2. 永远不会"误触后卡住"
3. 家属可远程配置播放内容
4. 架构简单、状态清晰、可控可运维

## 两种视图

### 老人视图（关怀模式）

- 打开应用进入 `/care` 关怀主页，只有两个按钮：**继续播放**（默认焦点）与**退出关怀模式**
- 主页停留数秒（默认 5 秒，可配置）后**自动续播上次观看位置**
- 播放页极简：无弹幕、无设置菜单、无推荐信息，只保留播放器和大号返回按钮
- 单集播完自动下一集；整部剧播完按**播放列表自动播下一部**（跨剧连播）
- 无任何观看历史与播放列表时不自动播放，提示由家人配置
- 退出关怀模式需通过**算术验证**（0-20 加减法），30 秒无操作自动回退
- 关怀模式开启后所有其他页面均被路由门禁重定向回 `/care`

### 管理员视图

- `/`：精简首页（进入老人视图 / 关怀管理 / 搜索选片 + 继续观看 + 收藏）
- `/search`：聚合搜索选片
- `/care-admin`：关怀模式管理
  - 播放策略：自动续播倒计时、验证超时、跨剧连播、列表循环
  - 播放列表：搜索添加、排序、删除、指定当前播放项
  - 远程配置：GitHub 配置文件地址、轮询间隔、一键导出配置 JSON
- `/admin`：原有站点管理后台（播放源配置等）

## 远程配置（GitHub 轮询）

家属把配置 JSON（`carecast.json`）提交到任意 GitHub 仓库，老人端按配置的间隔（默认 60 秒）
轮询拉取并自动生效，无需独立后端：

```jsonc
{
  "version": 1752700000000, // 递增版本号，大于本地已应用版本才生效
  "config": {
    "careModeEnabled": true,
    "countdownSeconds": 5,
    "verifyTimeoutSeconds": 30,
    "autoAdvance": true
  },
  "playlist": {
    "items": [
      {
        "id": "pli_1",
        "source": "源key",
        "vodId": "12345",
        "title": "某电视剧",
        "totalEpisodes": 40
      }
    ],
    "currentItemId": "pli_1",
    "loop": false
  },
  // 可选：远程点播指令，按 id 去重、只执行一次
  "command": {
    "id": "cmd-001",
    "type": "playNow",
    "source": "源key",
    "vodId": "67890",
    "title": "临时想看的电影"
  }
}
```

在 `/care-admin` 中可"导出当前配置 JSON"，复制后提交到仓库即可。
私有仓库支持填写 GitHub Token。支持 raw 链接与 GitHub 文件页链接。

## 快速开始

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

常用命令：

```bash
pnpm build      # 生产构建
pnpm typecheck  # 类型检查
pnpm lint       # 代码检查
pnpm test       # 单元测试
```

## 数据存储

- 默认 `localstorage` 模式：播放记录、关怀配置、播放列表均存于浏览器本地
- 可选 `redis` / `upstash` / `kvrocks` 模式（`NEXT_PUBLIC_STORAGE_TYPE` 环境变量）
- 关怀配置存储层（`src/lib/carecast.client.ts`）接口已按可替换后端设计，
  未来切换服务端存储无需改动上层页面

## 开发日志

关键设计决策、实现进度与文件改动说明见根目录 [DevLog.md](./DevLog.md)。

## 免责声明

本项目仅提供影视信息搜索服务，所有内容均来自第三方网站，本站不存储任何视频资源。

## 维护者

DimLoong
