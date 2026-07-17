# CareCastTV 开发日志

维护者：DimLoong

本文件记录 CareCastTV（护播）从 DecoTV 改造过程中的关键信息、设计决策、实现进度与文件改动说明。

---

## 2026-07-17 — M1：DecoTV → CareCastTV 核心改造

### 目标

在 DecoTV（Next.js 16 + React 19 + TypeScript + Tailwind 4 的影视聚合应用）基础上，
构建面向家庭老人场景的关怀模式闭环：

1. 打开应用延迟数秒自动续播上次观看位置
2. 跨剧顺序播放列表，自动连续播放
3. 老人视图 / 管理员视图分离，App 内可切换（算术验证）
4. 远程配置：轮询 GitHub 仓库中的配置文件
5. 品牌改名 CareCastTV，署名统一 DimLoong

### 关键设计决策

| 决策 | 理由 |
| --- | --- |
| 远程配置采用「GitHub 仓库 JSON 文件 + 老人端轮询」 | 无需独立后端；家属改一次文件全端生效；服务端代理转发解决 CORS 并支持私有仓库 token |
| 播放列表语义为「跨剧顺序队列」 | 单剧内自动下一集复用 DecoTV 播放器原有能力；整部剧播完后按队列跳下一部 |
| 退出关怀模式用算术验证（0-20 加减法） | 防误触而非防蓄意，无需记密码；30 秒无操作自动回退 |
| 关怀数据存 localStorage，接口按可替换后端设计 | 当前默认 localstorage 模式；未来切 redis/upstash 只需替换 carecast.client.ts 的读写实现 |
| 播放页跨剧跳转用整页导航（window.location） | play 页初始化依赖挂载期 effect，router.push 同页换参不会重新初始化 |
| 舍弃 PRD 中的「开机自启」「OTA 强制更新」 | 这两项是原生 TV 端能力，Web 版无法实现；Web 版刷新页面即等效更新 |
| 解锁状态存 sessionStorage | 关闭浏览器自动恢复关怀模式门禁，符合"老人设备默认锁定"预期 |

### 核心数据结构（src/lib/carecast.types.ts）

- `CareConfig`：关怀策略（careModeEnabled、countdownSeconds、verifyTimeoutSeconds、autoAdvance、remote 远程源）
- `CarePlaylist` / `CarePlaylistItem`：跨剧顺序队列（source + vodId 定位内容，currentItemId 指向当前项，loop 循环开关）
- `CareRemoteFile`（zod schema 校验）：远程配置文件（version 版本号防重放；config / playlist 覆盖；command.playNow 远程点播按 id 去重）
- 续播定位：复用 DecoTV 原有 `PlayRecord`（source+id → 第几集 + 秒数），不重复造轮子

### 新增文件

| 文件 | 说明 |
| --- | --- |
| `src/lib/carecast.types.ts` | 核心类型 + 远程配置文件 zod schema |
| `src/lib/carecast.client.ts` | 关怀数据存储层：配置/播放列表读写、续播目标解析（resolveResumeTarget）、跨剧下一项查找、远程配置应用（版本/指令去重）、解锁状态 |
| `src/app/api/carecast/remote/route.ts` | 远程配置拉取代理：GitHub 域名白名单（防 SSRF）、blob→raw 地址转换、token 走请求头、zod 校验后返回 |
| `src/hooks/useCareRemoteConfig.ts` | 轮询 hook（默认 60s，最小 10s，间隔可远程热更新）+ 手动拉取函数；playNow 指令触发整页跳转播放 |
| `src/app/care/page.tsx` | 关怀主页：大海报 + 大"继续播放"按钮 + 倒计时自动续播；无内容不自动播；退出按钮小且在角落 |
| `src/app/care/verify/page.tsx` | 算术验证页：0-20 加减法、大数字键盘、答错刷新题目、超时自动回退、支持物理键盘 |
| `src/app/care-admin/page.tsx` | 管理员视图：播放策略、播放列表编排（搜索/排序/删除/设当前/试播）、远程配置（测试拉取/导出 JSON） |
| `src/components/CareGate.tsx` | 路由门禁：关怀模式开启且未解锁时，非白名单路径一律重定向 /care |

### 修改文件

| 文件 | 改动 |
| --- | --- |
| `src/app/play/page.tsx` | ① `care=1` 参数进入关怀播放模式；② 全屏极简渲染分支（无导航/弹幕/设置菜单，大返回按钮）；③ 最后一集播完（video:ended 与跳片尾两处）调用 `handleCareSeriesEnded()` 跨剧连播；④ 播放中把当前剧标记为播放列表当前项；⑤ 播放错误自动重试一次；⑥ 观看期间持续轮询远程配置 |
| `src/app/layout.tsx` | 挂载 CareGate；metadata 更新为 CareCastTV / DimLoong |
| `src/app/page.tsx` | 首页重写：去掉豆瓣热门/番剧等发现内容，保留三大入口（老人视图/关怀管理/搜索）+ 继续观看 + 收藏 |
| `src/components/TopNavbar.tsx` | 导航精简为 首页/搜索/关怀管理（去掉豆瓣、直播、网盘、源浏览器） |
| `src/components/MobileBottomNav.tsx` | 同上（移动端底部导航） |
| `src/components/NavbarGate.tsx` | /care 与 /care/* 页面隐藏导航栏（/care-admin 保留） |
| `package.json` | name→carecasttv，author→DimLoong，docker 镜像名同步 |
| `src/**（全局）` | DecoTV/decotv 品牌字符串与 localStorage 键前缀统一替换为 CareCastTV/carecasttv；升级检查仓库指向 DimLoong/CareCastTV |
| `README.md` | 重写为 CareCastTV 产品说明（含远程配置文件格式示例） |
| 删除 `src/components/DecoTVFooterCard.tsx` | 首页重写后不再使用 |

### 实现说明（关键流程）

1. **打开即续播**：`/care` 挂载 → `resolveResumeTarget()`（播放列表 currentItem 优先 → 列表内最近播放记录 → 全局最新记录 → 无则不播）→ 倒计时结束 → 整页跳转 `/play?source=..&id=..&care=1` → play 页从 PlayRecord 恢复集数与秒数。
2. **跨剧连播**：play 页 `video:ended` 且已是最后一集 → `findNextPlaylistItem()`（不在列表返回 null；最后一项按 loop 决定回第一项）→ 整页跳转下一部。
3. **远程控制**：管理员改 `/care-admin` 配置 → 导出 JSON（version=时间戳，天然递增）→ 提交 GitHub → 老人端轮询 `/api/carecast/remote?url=...` → version 更大则应用；`command.playNow` 按 id 去重后立即切台。
4. **防误触闭环**：CareGate 全局重定向 + 播放页 care 模式去掉复杂控件 + 退出必须算术验证 + 验证页超时回退。

### 验证结果（2026-07-17）

- `pnpm typecheck` 通过（修复了 2 个类型错误：TopNavbar 残留的 source-browser 比较、carecast.client 中 PlayRecord 类型不一致）
- `pnpm lint:strict` 通过（0 错误 0 警告）
- `pnpm build` 生产构建通过，/care、/care/verify、/care-admin 路由均正常生成
- 生产服务器冒烟测试：登录后 /care、/care/verify、/care-admin、/ 均 200；/care 渲染出关怀主页内容
- 远程配置代理验证：非 GitHub 域名被拒（400）；raw 地址可拉取；github.com blob 地址自动转换 raw；非 JSON / 结构不符文件返回明确错误信息

### 部署注意事项

- **必须设置 `PASSWORD` 环境变量**：中间件（src/proxy.ts，DecoTV 原有机制）在未设置密码时会把所有页面重定向到 /warning。老人电视端首次使用需登录一次（cookie 保持），之后进入 /care 即全自动。
- localstorage 模式下关怀配置存在浏览器本地：远程控制通过 GitHub 配置文件轮询实现，管理员在任何设备改配置文件即可影响老人端。

---

## 2026-07-17 — M1.5：功能瘦身 + 关怀播放基础控件

### 目标

1. 关怀播放模式补齐基础播放功能：操作播放器的多为陪伴老人的子女，进度条、暂停、上/下一集、音量、倍速必须齐全。
2. 删除与 CareCastTV 定位无关的功能：弹幕、网盘、直播、成人内容、TVBox、源浏览器、豆瓣发现页。保留去广告功能。

### 关怀播放控件（src/app/play/page.tsx）

- ArtPlayer 默认控制栏本就含进度条/播放暂停/音量/全屏，关怀模式不再屏蔽
- 倍速改为所有模式开启（此前关怀模式关闭）
- 新增"上一集"控制栏按钮（与原有"下一集"成对）
- 设置菜单在关怀模式仍隐藏（去广告默认开启、跳片头片尾配置属管理员操作）

### 删除的功能与文件

| 功能 | 删除内容 |
| --- | --- |
| 弹幕 | `hooks/useDanmu.ts`、`components/DanmuManualMatchModal.tsx`、`api/danmu-external/*`、`api/admin/danmu`、播放页全部弹幕逻辑与 UI（约 500 行）、admin 弹幕配置区块、`artplayer-plugin-danmuku` 依赖 |
| 网盘 | `app/netdisk`、`api/pansou`、`api/admin/pansou`、`lib/pansou.ts`、`components/PanSouConfigPanel.tsx`、admin PanSou 区块、AdminConfig.PanSouConfig 类型 |
| 直播 | `app/live`、`api/live`、`api/admin/live`、`lib/live.ts`、`components/EpgScrollableRow.tsx`、admin 直播源区块、AdminConfig.LiveConfig 类型、cron 直播刷新、live 专用代理路由（proxy/m3u8/segment/key/stream/logo/cms）、`flv.js` 依赖；VideoCard 中历史 live 收藏点击不再跳转 |
| 成人内容 | proxy.ts 的 `/adult/` 路径重写入口；`resolveAdultFilter` 改为恒过滤（URL 参数 adult/filter 无法绕过）；搜索各路由硬编码过滤开启；admin"成人内容过滤"开关移除（不可关闭）；`DisableYellowFilter` 环境变量失效。源的 is_adult 标记功能保留（服务于过滤） |
| TVBox | `api/tvbox/*`、`api/proxy/spider.jar`、`api/spider`、`lib/spiderJar.ts`、admin TVBox 区块与全部 jar/诊断处理函数、TVBox配置优化说明.md |
| 源浏览器 | `app/source-browser`、`lib/source-browser.ts`、`hooks/useBrowseVideos.ts`、`hooks/useSourceFilter.ts`、SourceBrowserIcon |
| 豆瓣发现页 | `app/douban` 页面及其专属组件（DoubanSelector/DoubanCustomSelector/WeekdaySelector/DoubanCardSkeleton）。播放页的豆瓣元信息/推荐/影评保留（api/douban 保留） |
| 其他 | `components/Sidebar.tsx`（无引用）、`hooks/useCachedData.ts`（无引用）、`proxy.worker.js`（无引用）、`vidstack`/`@vidstack/react`/`media-icons`/`swiper` 依赖（无引用） |

保留：**去广告**（HLS CustomLoader，播放器设置默认开启）、下载功能、投屏、跳片头片尾、admin 的配置文件/站点/用户/视频源/分类/数据迁移区块。

### 验证

- `tsc --noEmit` 通过；`eslint --max-warnings=0` 通过；`next build` 通过
- 冒烟测试：/care、/care/verify、/care-admin、/、/admin、/search 均 200；/netdisk、/live、/adult/* 均 404
- 仓库无任何测试文件，jest 环境缺失为上游遗留，与本次无关

admin/page.tsx 由 9520 行瘦身到约 6100 行。

### 后续待办

- [ ] typecheck / lint / 手动验证（本阶段末尾执行）
- [ ] M2：关怀配置迁移到服务端存储（redis/upstash 模式下多设备共享）
- [ ] M2：老人端状态上报（当前在看什么、播放器状态），供家属远程查看
- [ ] M3：播放列表支持"从第 x 集到第 y 集"的区间播放
- [ ] M3：TV 遥控器方向键焦点管理专项优化（现依赖浏览器默认焦点行为 + autoFocus）
- [ ] 视觉：logo/favicon/manifest 图标仍是 DecoTV 素材，需替换为 CareCastTV 设计
