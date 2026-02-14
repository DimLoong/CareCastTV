# 护播（CareCast）— 关怀模式 TV 应用产品文档（最终轻量版）

> 基于 OrionTV（React Native TVOS / Android TV, Expo, TypeScript）二次开发  
> 定位：面向家庭老人场景的“零操作自动续播 + 防误触 + 可远程控制”的电视应用模式。

---

# 0. 产品核心原则

1. 老人不需要任何操作即可持续观看
2. 永远不会“误触后卡住”
3. 家属可远程查看、远程切换播放
4. 架构简单、状态清晰、可控可运维

---

# 1. 目标与范围

## 1.1 MVP 必做

- 开机自启进入 App
- 默认开启关怀模式
- 关怀主页仅两个按钮：继续播放（默认焦点）、退出关怀模式
- 进入主页 5 秒倒计时自动续播
- 支持多个第三方播放源
- 无历史记录时不自动播放任何内容
- 退出关怀模式需算术验证（加减 0-20）
- 验证页 30 秒无操作自动回退并继续播放
- 云端：指令轮询 + 状态上报
- 云端可下发 playUrl 直接切换播放
- 云端可强制软件更新

## 1.2 不做

- 搜索/推荐系统
- 账号体系
- 实时 WebSocket
- 多用户系统

---

# 2. 模式与状态机

## 2.1 三大状态

### A. 关怀主页（Care Home）

UI：
- 按钮 1：继续播放（默认焦点）
- 按钮 2：退出关怀模式

行为：
- 页面加载即开始 5 秒倒计时（可云端配置）
- 倒计时结束进入全屏播放页
- 遥控器仅允许在两个按钮之间切换焦点

返回键策略：
- 第一次按返回：提示“再次按返回退出”
- 5 秒内再次按返回：退出应用
- 超时取消

---

### B. 全屏播放页（Fullscreen Player）

支持多个第三方播放源

播放逻辑：
- 读取 lastPlayback
- 若存在则续播
- 若不存在则返回关怀主页（不自动播放）

播放页特性：
- 最小控制：暂停/继续、上一集/下一集、返回
- 每 10 秒保存进度
- 每 30 秒上报播放状态

错误处理：
- 自动重试一次
- 重试失败上报错误

---

### C. 退出验证页（Care Exit Verify）

规则：
- 随机生成加减题（0-20）
- 方向键选择数字输入
- 验证通过进入普通模式
- 验证失败刷新题目
- 30 秒无操作自动回退关怀主页

---

# 3. 普通模式整合

现有 TV 应用已有完整普通模式页面。

新增：
- 在普通模式设置页提供“开启关怀模式”开关
- 开启后立即跳转关怀主页
- 关闭后恢复普通模式

路由门禁：

if careModeEnabled:
    仅允许访问 /care/*
else:
    访问 normal routes

---

# 4. 播放源与播放策略

## 4.1 多第三方源支持

lastPlayback 结构：

- seriesId
- episodeId
- playUrl
- sourceId
- positionMs
- updatedAt

说明：
- 云端下发 playUrl
- TV 端不解析资源站

## 4.2 无历史播放策略

- 不自动播放
- 保持在关怀主页

---

# 5. 云端能力设计

## 5.1 设备标识

- 首次启动生成 deviceId
- 本地持久化
- 所有请求携带 deviceId

## 5.2 指令轮询

GET /v1/device/{deviceId}/command  
轮询间隔：10 秒

命令类型：

### playNow

{
  type: "playNow",
  playUrl: "...",
  title: "...",
  cover: "..."
}

行为：
- 停止当前播放
- 切换 playUrl
- 更新 lastPlayback
- 上报结果

### setConfig

{
  type: "setConfig",
  careModeEnabled: true/false,
  countdownSeconds: 5,
  verifyTimeoutSeconds: 30,
  forceUpdateVersion: "1.2.0"
}

### forceUpdate
可单独下发或包含在 setConfig 中

## 5.3 状态上报

POST /v1/device/{deviceId}/status

字段：
- mode
- currentScreen
- nowPlaying
- playerState
- appVersion
- networkType
- timestamp

上报频率：30 秒

## 5.4 错误上报

POST /v1/device/{deviceId}/error

字段：
- errorType
- errorCode
- message
- stack
- playUrl
- commandId

---

# 6. 强制更新机制

云端下发：

forceUpdateVersion: "1.2.0"

TV 端逻辑：
- 若当前版本低于目标版本
- 显示“正在更新，请勿断电”页面
- 禁止进入其他页面
- 执行 OTA 更新
- 更新成功后自动重启

更新失败：
- 每 60 秒重试
- 不允许跳过

---

# 7. 本地数据结构

- DeviceState
- CareConfig
- PlaybackHistory
- PendingCommandAck

---

# 8. 关键指标

- 自动续播成功率
- 播放错误率
- 远程切换成功率
- 更新成功率
- 验证页超时次数

---

# 9. 版本规划

M1：关怀模式闭环  
M2：云端轮询 + 上报  
M3：强制更新 + 运维增强  

---

# 10. 项目命名

中文：护播  
英文：CareCast  

含义：守护式持续播放，为老人构建无需操作的观看体验。
