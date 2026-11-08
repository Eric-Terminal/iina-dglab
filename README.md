# IINA 郊狼音频联动

将 IINA 当前播放音频的响度、起音变化与过零率映射为郊狼波形，通过 **DG-LAB 4 App 的 Socket 控制（V4）**输出。插件有独立控制窗口、实时电平图、配对二维码、A/B 独立限幅和停止按钮。

目标环境：带插件系统和 `standaloneWindow.isOpen()` 接口的 IINA（建议 1.5.1 或更新版本）、DG-LAB 4 App、郊狼 3.0。缺少窗口状态接口时会禁用开始按钮并提示升级。当前不支持旧 App 的 V3 Socket 协议，也不控制郊狼 2.0 或其他型号。

## 安装与连接

1. 双击 `artifacts/iina-dglab-1.0.0.iinaplgz`，在 IINA 中完成安装并启用。若没有出现插件菜单，重启 IINA。
2. 打开带音轨的媒体，在该播放窗口的 **插件 → 郊狼音频联动 → 打开音频联动（使用当前窗口）** 打开控制台。多个播放窗口中，只有最后手动选择的窗口提供音频。
3. 点 **连接 App**。默认使用官方 V4 中继 `wss://trex.dungeon-lab.cn/v4`，不需要在 Mac 上另外运行 Node.js 服务。
4. 在 DG-LAB 4 的 **Socket 控制**中连接服务器：手机可以扫二维码；同一台 Mac 上可复制插件显示的 Socket 地址到 App。二维码使用官方 V4 跳转格式。
5. 在 App 中连接并启用郊狼 3.0；插件会自动接收设备列表、连接状态及通道上限。有多个设备时手动选择一个。
6. 为需要的通道设置强度上限，点 **应用参数**，再点 **开始联动**。两个通道的初始上限均为 **0**；仅连接、配对和预览不会发出设备操作。

插件里的强度上限与波形幅度是两个不同概念：通道强度取用户上限与 App 上限的较小值；音频控制的是波形幅度（0～100）。不要将波形幅度 100 理解为设备强度 100。

## 算法

每 100 ms 读取一次 mpv 的 `astats` 元数据，不捕获麦克风或系统音频。统计滤镜只追加自己的标签 `iina_dglab`，不会覆盖均衡器或其他已有滤镜。音频直通不提供可用 PCM 统计，需要在 IINA 中关闭直通。

默认「动态混合」使用 RMS 为主的电平，并在 RMS 快速上升时增加 Peak 权重：

```text
起音变化 = max(本次 RMS − 上次 RMS, 0)
峰值权重 = 0.15 + 0.30 × clamp(起音变化 / 12, 0, 1)
混合电平 = RMS + max(Peak − RMS, 0) × 峰值权重
归一化响度 = clamp((混合电平 − 当前门限) / (满幅电平 − 当前门限), 0, 1)
目标波形幅度 = floor(归一化响度 ^ 响应指数 × 波形幅度上限)
```

- **自适应门限**：取最近约 8 秒电平的第 20 百分位作为底噪估计，加 6 dB 余量。至少 20 个样本后启用，门限每秒最多变化 3 dB，最多比用户门限高 12 dB，并限制在满幅电平以下。
- **滞回**：开门需要超过当前门限 2 dB，关门使用当前门限，减少临界电平反复开关。低于关闭门限立即清零，不做静音拖尾。
- **包络平滑**：门限以上使用 35 ms attack / 90 ms release 的指数平滑。默认响应指数为 1.1；仍可选择纯 RMS 或 Peak，并设置原示例的 0.8 指数。
- **频率映射**：读取每个音频声道的 `Zero_crossings_rate`，按 RMS 能量加权，换算到 48 kHz 标度，再做三点中值和 120 ms 指数平滑。ZCR 从 0.02 升到 0.22 时，频率编码从 100 降到 10。编码不是 Hz，越小表示脉冲越密。
- **波形封包**：每帧 8 字节，前 4 字节为频率编码，后 4 字节为幅度的 70%、85%、100%、90%。单帧代表 100 ms。

ZCR 与响度不能可靠识别人声、撞击或音乐；自适应门限也不能分离背景音乐。持续音乐或持续人声都可能使门限上升，此时可以关闭自适应门限并手动调整。这里没有生理恢复、避免麻木等效果保证。

`astats reset=1` 只是每个解码音频帧重置统计，不代表零延迟。mpv 解码预读、100 ms 采样、网络、App 调度和蓝牙都会影响同步；很短的瞬态可能落在两次采样之间。

## 停止与恢复

| 情况 | 行为 |
| --- | --- |
| 暂停、静音、音量为零、缓冲、跳转、低于门限 | 清除本插件使用通道的任务并将强度归零，保持联动开关；恢复有效音频后继续 |
| 播放结束、换文件、换音源、换设备、断连、指令失败、采样中断超过 350 ms | 停止并解除联动，必须手动重新开始 |
| 点击停止、控制台内按 Esc | 停止并解除联动 |
| 播放窗口中按 Ctrl+Option+Esc | 通过插件菜单快捷键停止 |
| 关闭控制台 | 支持 `standaloneWindow.isOpen()` 的 IINA 中由原生定时器检测并停止 |

每次只发送当前的一帧，使用 V4 的 `im: true` 替换同类任务。未收到上一批指令的响应时丢弃新帧，不排队补发；波形任务最长 100 ms，临时强度任务 250 ms。停止时清任务并发送归零命令。网络已断开时无法保证停止指令送达，有限时任务用于限制残留输出；硬件实际停止时间仍需实机验证。

App 未回传通道上限、通道静音或设备离线时，不开始该通道输出。恢复连接不会自动开始。不要同时使用其他控制端给同一设备通道安排任务，清理操作按设备与通道生效。

## 连接与权限

连接采用控制窗口的标准 WebSocket 与官方 `dglab-kit`，而非 `iina.ws`：IINA 原生 `ws` 是服务端接口，其当前实现既不暴露请求 URL，又发送二进制帧。插件使用一个全局控制窗口管理连接，各播放器只传递本地统计值。

官方中继接收设备操作与 App 状态；插件不上传媒体文件、文件名、原始音频或 RMS/ZCR 数据。也可以在「服务器」中填写自建 V4 WebSocket 地址。

安装时声明的权限：网络用于 Socket 通信；文件系统是 IINA 执行 `af` 命令所需权限。插件不会扫描用户媒体目录或执行外部程序。所有运行依赖已经打包，本机安装无需 npm。

## 开发与验证

```sh
cd '/Users/Eric/Dev/JS:TS/iina-dglab'
npm ci
npm run check
npm test
npm run test:mpv   # 需要本机 ffmpeg 和 mpv；使用空音频输出，不连接设备
npm run pack
```

项目路径中含 `:`，npm 注入的 `.bin` 路径会被 POSIX PATH 分隔。因此脚本显式通过 `node node_modules/...` 调用工具，避免意外使用系统全局版本。

`dist/` 随 Git 提交，IINA 无需现场构建。开发时可以运行官方 CLI：

```sh
/Applications/IINA.app/Contents/MacOS/iina-plugin link "$PWD"
```

重启 IINA 并在插件设置中启用开发插件。本项目没有自动重启用户正在使用的 IINA，也没有修改真实 App 的配对和输出状态。

`scripts/preview.ts` 提供仅监听回环地址的本地界面测试页，包含合成音频与虚拟设备：

```sh
npm run build
node node_modules/tsx/dist/cli.mjs scripts/preview.ts
```

已验证：TypeScript 类型检查；声学映射与停止状态测试；IINA 入口模拟；官方 SDK 经真实 WebSocket 的 V4 往返；真实 mpv / FFmpeg 的静音、180 Hz 与 5 kHz 音频元数据及滤镜保留。当前尚未完成 IINA 原生窗口的视觉验收或与实体郊狼的端到端测试。浏览器视觉检查因自动化访问限制中止。后续实机应先验证配对、状态回传、暂停/跳转归零，再由使用者手动设置适合自己的通道上限。

## 结构

| 文件 | 职责 |
| --- | --- |
| `src/main.ts` | 单个 IINA 播放窗口的音频采样、播放状态与滤镜生命周期 |
| `src/global.ts` | 选择音源、全局窗口、偏好存储、原生超时检测 |
| `src/audio.ts` | 元数据解析、噪声门、包络与频率映射 |
| `src/controller.ts` | 通道限幅、指令发送、停止和超时状态 |
| `src/ui.*` | 控制窗口、V4 SDK 连接与二维码 |
| `tests/` | 算法、控制器、IINA 适配与 V4 集成测试 |

## 参考与许可

- [IINA 插件 API](https://docs.iina.io/)、[IINA WebSocket API](https://docs.iina.io/interfaces/IINA.API.WebSocket.html)
- [DG-LAB 4 官方 SDK 与 V4 协议](https://github.com/dungeonlab-open/dglab-kit/blob/main/README_CN.md)
- [官方 V4 中继实现](https://github.com/dungeonlab-open/dglab-websocket-server/blob/main/v4-server.ts)
- [旧版 Socket 协议](https://github.com/dungeonlab-open/dglab-websocket-simple/blob/main/socket/v2/README.md)
- [OTCMultiPlugin](https://github.com/qianxiao1213/OTCMultiPlugin)：参考连接/回传/双通道控制思路，未复制其代码。

用户提及的 Hum / YTMinamp 未找到可确认的对应实现，没有据此假设接口或复制算法。

插件按 GPL-3.0-only 提供，与所打包的官方 SDK 许可证保持一致；第三方声明见 `THIRD_PARTY_NOTICES.md`。项目源代码、构建脚本和依赖锁文件均包含在安装包中。
