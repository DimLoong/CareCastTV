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

## 快速开始（本地开发）

```bash
pnpm install

# 在项目根目录创建 .env.local 文件，写入访问密码（见下方说明）
echo 'PASSWORD=你的密码' > .env.local

pnpm dev        # http://localhost:3000
```

常用命令：

```bash
pnpm build      # 生产构建
pnpm typecheck  # 类型检查
pnpm lint       # 代码检查
```

## 环境变量：PASSWORD 为什么是必须的

本项目的鉴权中间件（`src/proxy.ts`）在**未设置 `PASSWORD` 时会把所有页面重定向到警告页**，
应用无法使用。这是刻意设计：

- 本应用会代理请求第三方影视资源站，若无密码地公开在互联网上，任何人都能消耗你的服务器流量
- 部署到 Vercel 等公网平台时，无密码等于把服务完全暴露

所以 **`PASSWORD` 在任何部署方式下都必须设置**。电视/手机端首次打开时输入一次密码，
登录状态保持 365 天（针对老人电视场景特意延长），之后打开即用。

各环境的配置位置：

| 环境 | 配置方法 |
| --- | --- |
| 本地开发 | 项目根目录建 `.env.local` 文件，内容 `PASSWORD=你的密码`（该文件已被 git 忽略，不会提交） |
| Docker | 启动命令加 `-e PASSWORD=你的密码` |
| Vercel | 项目 Settings → Environment Variables 中添加（见下方 Vercel 部署流程第 4 步） |

### 全部环境变量一览

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `PASSWORD` | ✅ | 访问密码，所有模式必填 |
| `NEXT_PUBLIC_STORAGE_TYPE` | 否 | 存储模式：`localstorage`（默认）/ `upstash` / `redis` / `kvrocks`。**Vercel 部署请用 `upstash`**，原因见下 |
| `USERNAME` | 数据库模式必填 | 站长（owner）账号名，`upstash`/`redis` 模式下用于登录管理后台 |
| `UPSTASH_URL` / `UPSTASH_TOKEN` | upstash 模式必填 | Upstash Redis 的 REST 地址与 Token |
| `AUTH_SECRET` | 生产建议 | 签名密钥，`openssl rand -base64 32` 生成 |
| `NEXT_PUBLIC_SITE_NAME` | 否 | 站点名，默认 CareCastTV |
| `ANNOUNCEMENT` | 否 | 首页公告文案 |

## 部署到 Vercel（推荐，免费零运维）

> ⚠️ 关键前提：Vercel 是 Serverless 环境，函数实例的内存不持久。
> 默认的 `localstorage` 模式把播放源配置同步到服务端**内存**，冷启动后会丢失，
> 导致搜索无结果。因此 **Vercel 部署必须搭配 Upstash Redis（有免费额度）持久化配置**。

完整流程：

1. **Fork / 推送本仓库到你的 GitHub 账号**

2. **创建 Upstash Redis（免费）**
   - 打开 [upstash.com](https://upstash.com)，用 GitHub 账号登录
   - Create Database → 选个离你近的区域 → 创建
   - 进入数据库详情页，复制 **REST API** 区域的 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`

3. **导入项目到 Vercel**
   - 打开 [vercel.com](https://vercel.com)，用 GitHub 账号登录
   - Add New → Project → 选择本仓库 → 保持默认构建设置（项目已带 `vercel.json`）

4. **配置环境变量**（Import 页面或部署后的 Settings → Environment Variables）：

   ```
   PASSWORD                  = 你的访问密码
   USERNAME                  = 站长账号名（如 admin）
   NEXT_PUBLIC_STORAGE_TYPE  = upstash
   UPSTASH_URL               = 第 2 步复制的 REST URL
   UPSTASH_TOKEN             = 第 2 步复制的 REST Token
   AUTH_SECRET               = openssl rand -base64 32 的输出
   ```

5. **Deploy**，完成后获得 `https://你的项目名.vercel.app` 域名

6. **初始化配置**
   - 访问 `https://你的项目名.vercel.app`，用 `USERNAME` + `PASSWORD` 登录
   - 进入 `/admin` → 「配置文件」粘贴播放源配置（或填写订阅地址）→ 保存
   - 进入 `/care-admin` 搜索节目、编排播放列表、开启关怀模式

> 提示：vercel.app 域名在部分网络环境下无法直接访问，可在 Vercel 上绑定自己的域名解决。

## 部署到自己的设备（Docker）

适合家里有 NAS / 树莓派 / 闲置电脑的场景，纯局域网可用：

```bash
docker build -t carecasttv .
docker run -d --name carecasttv -p 3000:3000 \
  -e PASSWORD=你的密码 \
  --restart unless-stopped \
  carecasttv
```

电视端访问 `http://<设备局域网IP>:3000`。此方式用默认 `localstorage` 模式即可
（服务器进程常驻，配置不会丢失）；若要多设备共享播放进度，再按上表接入 redis。

## 安卓电视安装（WebView 壳 APK）

本仓库 [tvshell/](./tvshell/) 目录是一个极简 Android TV 壳应用：全屏 WebView 加载你部署好的
CareCastTV 地址，支持开机自启、屏幕常亮、遥控器按键。构建方法见
[tvshell/README.md](./tvshell/README.md)（支持 GitHub Actions 云端出包，无需本地装 Android Studio）。

## 数据存储说明

- `localstorage` 模式（默认）：播放记录、关怀配置、播放列表均存于浏览器本地
- `upstash` / `redis` / `kvrocks` 模式：数据存服务端，多设备共享
- 关怀配置存储层（`src/lib/carecast.client.ts`）接口已按可替换后端设计，
  未来切换服务端存储无需改动上层页面

## 开发日志

关键设计决策、实现进度与文件改动说明见根目录 [DevLog.md](./DevLog.md)。

## 免责声明

本项目仅提供影视信息搜索服务，所有内容均来自第三方网站，本站不存储任何视频资源。

## 维护者

DimLoong
