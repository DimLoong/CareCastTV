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

---

## 2026-07-17 — M2：部署文档 + 安卓电视壳 APK

### 目标

1. 说清 `PASSWORD` 环境变量的必要性与各环境配置方法（写入 README）
2. 检查并适配 Vercel 部署，流程写入 README
3. 生成安卓电视 WebView 壳 APK 工程，支持云端出包

### 关键决策与发现

| 事项 | 结论 |
| --- | --- |
| `PASSWORD` 是否必要 | 必要。应用代理第三方资源站，公网裸奔会被滥用；中间件在无密码时锁定全站是正确设计，予以保留 |
| 登录 cookie 有效期 | 由 7 天延长到 **365 天**（`api/login/route.ts` 三处）。老人电视场景不能每周重新登录 |
| Vercel + localstorage 模式的坑 | Serverless 内存不持久，播放源配置冷启动即丢 → **Vercel 部署必须搭配 Upstash（免费）**，README 已写明 |
| vercel.json 清理 | 移除指向已删除 `/api/proxy/*` 的 rewrite；cron（每日 1 点）保留，Hobby 计划兼容 |
| 壳 APK 技术选型 | 纯 Android WebView（Kotlin，零第三方依赖，APK 约 100KB），不用 Capacitor——更小更可控，且能实现开机自启 |

### 新增文件

| 文件 | 说明 |
| --- | --- |
| `tvshell/` | Android TV 壳工程：`MainActivity.kt`（全屏 WebView、自动播放放行、Cookie 持久化、返回键防误触）、`BootReceiver.kt`（开机自启）、Manifest（Leanback + 普通桌面双入口、允许 http 局域网地址）、图标与 TV banner |
| `.github/workflows/build-apk.yml` | GitHub Actions 云端构建：Actions 页手动触发、可输入服务器地址、产物 Artifacts 下载；tvshell 目录变更时也自动构建 |
| `tvshell/README.md` | 壳应用构建（云端/本地两种方式）、电视安装、开机自启授权等说明 |

### 修改文件

| 文件 | 改动 |
| --- | --- |
| `src/app/api/login/route.ts` | 登录 cookie 有效期 7 天 → 365 天 |
| `vercel.json` | 移除失效 rewrite |
| `README.md` | 新增：PASSWORD 必要性与三种环境配置方法、全部环境变量表、Vercel 部署六步流程（含 Upstash）、Docker 部署、壳 APK 入口 |

---

## 2026-07-17 — M2.1：永久免登录 + 播放源配置文档

### 改动

1. **永久免登录**：Chromium（含电视 WebView）对 cookie 有 400 天硬上限，无法写"永久"cookie。
   方案：登录 cookie 写满 400 天（`api/login/route.ts` 三处），并新增
   `components/AuthCookieRefresher.tsx`（挂载于 layout）在每次打开应用时把 auth cookie
   原值重写续期 400 天——滑动续期，只要设备一年内打开过一次即永不过期。
2. **播放源配置文档**（README 新增章节）：
   - 说明本项目吃苹果 CMS V10 采集接口（`/api.php/provide/vod`），
     TVBox 格式配置（饭太硬等）不能直接用，但其 `sites` 中 `type:1` 条目的 api 可摘出使用
   - key/name/api/detail/is_adult 字段含义（key 即关怀播放列表与 carecast.json 的 `source`）
   - 配置文件批量导入 JSON 模板 + 单个添加两种方法

---

## 2026-07-17 — M2.2：管理区域信息架构重构 + 视频源可编辑

### 目标

1. 导航精简为「首页 / 搜索 / 管理」三项；管理内以三个标签页组织：关怀管理、本地设置、管理员设置
2. 用户头像面板只保留退出登录（原来塞在里面的设置/管理入口全部挪走）
3. 视频源配置支持编辑（原来只能添加/删除/启停）

### 改动

| 文件 | 说明 |
| --- | --- |
| `components/ManageTabs.tsx`（新增） | 管理区域顶部标签栏：关怀管理 /care-admin、本地设置 /settings、管理员设置 /admin，按路由高亮 |
| `components/LocalSettingsPanel.tsx`（新增） | 本地设置页面内容：豆瓣数据/图片代理、聚合搜索、优选测速、流式搜索、播放缓冲模式、恢复默认，外加下载管理入口、版本信息、修改密码（数据库模式非站长）。localStorage 键名与原实现兼容；原面板中的 IPTV 直连项随直播功能删除 |
| `app/settings/page.tsx`（新增） | 管理 → 本地设置 页面（PageLayout + ManageTabs + LocalSettingsPanel） |
| `components/UserMenu.tsx`（重写，1328→140 行） | 头像面板只保留：用户信息 + 退出登录 |
| `components/TopNavbar.tsx` / `MobileBottomNav.tsx` | 第三项改为「管理」，/care-admin、/settings、/admin 三个路由都高亮该项 |
| `app/care-admin/page.tsx`、`app/admin/page.tsx` | 页面顶部接入 ManageTabs |
| `api/admin/source/route.ts` | 新增 `edit` 动作：更新 name/api/detail；key 不可改（被播放记录与关怀播放列表引用）；编辑过的源标记为 custom 防止被订阅配置覆盖 |
| `app/admin/page.tsx`（视频源配置） | 每行新增「编辑」按钮，复用添加表单进入编辑模式（key 置灰、按钮变"保存修改"、成人开关隐藏）；本地模式 `updateSourceConfigLocally` 同步支持 edit |

### 验证

- typecheck / eslint / next build 通过；/settings 路由正常生成
- 冒烟测试：/settings、/care-admin、/admin 均 200，三个标签在页面上渲染正确

## 2026-07-17 — M2.3：橙色品牌化 + 电视端左右结构布局

### 目标

1. 品牌色改为橙色，并定义全局橙色渐变；logo、slogan、重要标题用渐变，关键按钮用橙色
2. TDesign 主题接管：组件库品牌色全局翻橙，暗色模式跟随全站 .dark 主题
3. 管理区域按电视端 UI 逻辑改为左右结构：左侧纵向 tab、右侧对应内容

### 设计决策

- **品牌色全局唯一定义处**：`globals.css` 中 `--brand-color: #ff6a00`、`--brand-gradient: linear-gradient(135deg, #ffb347 → #ff7a1a → #ff4d00)`。改这里即全站换色
- **TDesign 接管方式**：覆盖 `--td-brand-color-1..10` 系列变量（亮/暗两套），TDesign 组件（含用户自建的 CountdownOutlineButton）无需改代码即变橙；新增 `TDesignThemeSync` 监听 `<html>` 的 `.dark` 类并同步 `theme-mode` 属性，解决 next-themes 与 TDesign 暗色机制不一致的问题
- **工具类**：`.brand-gradient-text`（渐变文字）、`.brand-gradient-bg`（渐变底）、`.brand-btn`（关键按钮：渐变+阴影+按压反馈）、`.tv-focus`（遥控器 D-pad 焦点环，:focus-visible 3px 橙色描边）
- **电视端左右结构**：`ManageLayout` 取代 ManageTabs——左侧纵向列表含两层：主 tab（关怀管理/本地设置/管理员设置，路由跳转）+ 当前页子 tab（页面内分区，state 切换）；移动端退化为顶部横向 pill

### 改动

| 文件 | 说明 |
| --- | --- |
| `globals.css` | 品牌色系统（见上）；`.deco-brand`（导航 logo）与 `.neon-text`（登录页 logo）渐变翻橙；新增 `.chip-care-admin` 橙色光晕（此前缺失定义） |
| `components/TDesignThemeSync.tsx`（新增） | .dark ↔ theme-mode 同步器，挂在根布局 |
| `components/ManageLayout.tsx`（新增） | 电视端左右结构布局组件，替代 ManageTabs（已删除） |
| `app/admin/page.tsx` | 折叠面板（CollapsibleTab）整体移除，改为左子 tab / 右内容：视频源/站点/用户/分类（+站长专属：配置文件/数据迁移），一次只渲染激活分区；buttonStyles.primary 系翻橙、toggleOn 翻橙 |
| `app/care-admin/page.tsx` | 接入 ManageLayout，内部分为 播放列表/播放策略/远程配置 三个子 tab；主按钮与选中态翻橙 |
| `app/settings/page.tsx` | 接入 ManageLayout |
| `app/page.tsx` | logo 渐变翻橙；新增 slogan「打开就能看 · 家人远程照护」（渐变）；三个入口卡片与倒计时按钮翻橙 |
| `app/login/page.tsx` | logo 下新增 slogan；登录按钮 `.brand-btn`；输入框焦点环/注册链接翻橙 |
| `app/care/page.tsx`、`care/verify/page.tsx` | 老人端大按钮改橙色渐变，焦点环改橙（保留大尺寸 ring 便于电视遥控可见） |
| `components/TopNavbar.tsx` / `MobileBottomNav.tsx` | 激活态统一品牌橙（顶栏橙色 ring、底栏橙渐变胶囊） |
| `components/LocalSettingsPanel.tsx` | 开关/选中卡片/焦点环等激活色翻橙 |
| `app/layout.tsx` | 顶部进度条颜色翻橙；挂载 TDesignThemeSync |

### 验证

- typecheck / eslint / next build 全部通过
- 冒烟（PASSWORD=test123）：/、/settings、/care-admin、/admin、/login 均 200；/settings 左侧三 tab + brand 渐变类渲染正确；首页与登录页 slogan 渲染正确

### 后续待办

- [ ] M2：关怀配置迁移到服务端存储（redis/upstash 模式下多设备共享）
- [ ] M2：老人端状态上报（当前在看什么、播放器状态），供家属远程查看
- [ ] M3：播放列表支持"从第 x 集到第 y 集"的区间播放
- [ ] M3：TV 遥控器方向键焦点管理专项优化（现依赖浏览器默认焦点行为 + autoFocus）
- [ ] 视觉：logo/favicon/manifest 图标仍是 DecoTV 素材，需替换为 CareCastTV 设计
