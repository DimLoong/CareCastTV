# CareCastTV 安卓电视壳应用（tvshell）

一个极简的 Android TV WebView 壳：全屏加载你部署好的 CareCastTV 站点。
零第三方依赖，APK 体积约 100KB。维护者：DimLoong

## 功能

- 全屏 WebView 加载 CareCastTV（地址构建时注入）
- **开机自启**（Web 版做不到、PRD 想要的能力，在壳里实现）
- 屏幕常亮，观看中不休眠
- 自动播放放行（`mediaPlaybackRequiresUserGesture=false`，保证"零操作自动续播"）
- 登录 Cookie 持久化：输一次密码，一年内免登录
- 返回键防误触：网页可后退则后退，退出应用需 3 秒内连按两次
- 兼容 Android 5.0+ 的电视和盒子，同时注册 TV 桌面（Leanback）与普通桌面入口

## 构建方式一：GitHub Actions 云端出包（推荐，无需装任何环境）

1. 把仓库推到 GitHub（fork 或自己的仓库）
2. 仓库页面 → **Actions** → 左侧选 **Build TV Shell APK** → **Run workflow**
3. 在 `server_url` 输入框填你的服务器地址，例如：
   - `https://你的项目.vercel.app`（Vercel 部署）
   - `http://192.168.1.100:3000`（家里 NAS/Docker 部署，注意电视和它要在同一局域网）
4. 等待约 2 分钟构建完成，进入这次 run 的页面，底部 **Artifacts** 下载 `CareCastTV-apk`

## 构建方式二：本地 Android Studio

1. 编辑 `tvshell/gradle.properties`，把 `CARECAST_URL` 改成你的服务器地址
2. 用 Android Studio 打开 `tvshell/` 目录，等待 Gradle 同步
3. Build → Build App Bundle(s) / APK(s) → Build APK(s)
4. 产物在 `tvshell/app/build/outputs/apk/release/app-release.apk`

## 安装到电视

常见方法任选其一：

- **U 盘**：APK 拷入 U 盘，插电视，用电视自带文件管理器打开安装
- **局域网推送**：电视装"悟空遥控器/当贝助手"等工具，从手机推送 APK
- **ADB**：电视打开开发者选项和 ADB 网络调试后，
  `adb connect 电视IP && adb install app-release.apk`

安装时如提示"未知来源"，在电视 设置 → 安全 中允许即可。

## 首次使用

1. 打开应用，进入登录页，输入部署时设置的 `PASSWORD`（数据库模式还需 `USERNAME`）
2. 登录状态保持 365 天，之后开机即进入关怀主页自动续播

## 已知注意事项

- **开机自启**：Android 10+ 部分设备限制后台启动界面，需在系统设置中为本应用
  授予"自启动"权限（各厂商入口不同，一般在 应用 → 权限/自启管理）
- **遥控器方向键**：依赖系统 WebView 的焦点导航，主要按钮（继续播放、数字键盘）均可聚焦；
  如个别机型方向键无响应，可配鼠标/飞鼠使用，后续版本会做专项优化
- **修改服务器地址**：地址是构建时写入的，换地址需重新构建 APK
