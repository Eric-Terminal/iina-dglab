# 第三方代码声明

本项目的 `dist/ui.js` 和 `dist/relay.cjs` 由以下依赖打包生成。原始许可证保存在 `licenses/`；未修改这些第三方库的源码。

| 项目 | 许可证 | 用途 |
| --- | --- | --- |
| [dglab-kit 1.0.5](https://github.com/dungeonlab-open/dglab-kit) | GPL-3.0 | DG-LAB 4 的 V4 连接、设备状态与 RPC |
| [eventemitter3](https://github.com/primus/eventemitter3) | MIT | 官方 SDK 的事件分发 |
| [qrcode 1.5.4](https://github.com/soldair/node-qrcode) | MIT | 本地生成配对二维码 |
| [dijkstrajs](https://github.com/andrewhayward/dijkstra) | MIT | 二维码编码内部依赖 |
| [ws 8.22.1](https://github.com/websockets/ws) | MIT | 本机中继的 WebSocket 服务端 |

精确版本和完整性哈希记录在 `package-lock.json`。TypeScript、esbuild、tsx 和类型定义仅用于开发、构建或本地测试，不在插件运行时执行。`ws` 的可选原生扩展未打包，运行时使用纯 JavaScript 实现。
