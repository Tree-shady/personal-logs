# Raspberry MC Server Manager

树莓派 Minecraft 服务端管理器 —— 基于 Electron 的跨平台桌面应用，用于在本地（或树莓派等 Linux 设备）集中创建、运行和管理多个 Minecraft 服务端实例。

内置 Express API + WebSocket 实时控制台，支持服务端核心自动下载、多实例进程管理、实时日志与命令下发、本地模组管理等功能。

## 功能特性

- **多服务端实例管理**：在同一应用中创建并管理多个相互独立的 MC 服务端，支持 Vanilla / Paper / Forge / Fabric 四种类型。
- **核心自动下载**：创建时选择类型与版本，自动从官方源下载服务端核心 jar（目前 Vanilla、Paper 已实现，见[已知限制](#已知限制)）。
- **一键启停**：启动时按配置注入内存参数（`-Xms` / `-Xmx`）；停止时先发送 `stop` 优雅关闭，超时自动强杀进程。
- **实时控制台**：通过 WebSocket 推送服务端日志，可查看历史日志并直接在输入框下发控制台命令。
- **模组管理**：上传本地 `.jar` 模组，通过重命名 `.disabled` 后缀快速启用 / 禁用，无需删除文件。
- **开机自启**：标记为 `autoStart` 的服务端会在应用启动后自动拉起；应用退出时统一优雅关闭所有进程。
- **独立配置**：每个服务端可单独设置端口、Java 路径、最小 / 最大内存；配置以 JSON 持久化。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面框架 | Electron 31 |
| 主进程语言 | TypeScript（Node.js） |
| 本地服务 | Express 4（REST API）+ ws（WebSocket 日志推送）|
| 进程管理 | child_process 进程池，spawn Java 进程 |
| 渲染层 | React 18 + React Router 6 + Vite 5 |
| 构建打包 | electron-builder（Windows nsis / Linux AppImage、deb）|

## 环境要求

- Node.js 18+
- 运行环境需安装 **Java**（服务端实际运行依赖，默认使用 PATH 中的 `java`，也可在创建时为每个服务端单独指定）
- 可访问 Mojang / PaperMC 等核心下载源的网络

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（并行编译主进程并启动 Vite 开发服务器）
npm run dev

# 构建主进程与渲染层
npm run build

# 打包桌面安装包（产物输出到 release/）
npm run package
```

开发模式下，Electron 窗口加载 `http://localhost:5173`（Vite），内置 API 默认监听 `http://localhost:25560`。

## 使用说明

1. 启动应用后在服务器列表页点击「创建服务器」。
2. 填写名称、类型、游戏版本、端口与内存，提交后应用会自动下载核心、写入 `eula.txt`（自动接受 EULA）并初始化 `server.properties`。
3. 进入服务器详情页，可启动 / 停止服务端、查看实时控制台、发送命令，以及上传和管理模组。
4. 服务端文件保存在 Electron `userData` 目录下的 `servers/<实例ID>/` 中，实例与应用配置保存在 `data/servers.json`。

## 项目结构

```
src/
├── main/                       # Electron 主进程
│   ├── index.ts                # 应用入口：初始化模块、启动 API 与窗口
│   ├── preload.ts              # 预加载脚本
│   ├── types.ts                # 共享类型定义
│   ├── api/routes.ts           # Express REST 路由 + WebSocket 日志推送
│   ├── config/ConfigManager.ts # 配置持久化（data/servers.json）
│   ├── server/
│   │   ├── ServerManager.ts    # 实例的创建/启动/停止/删除/自启
│   │   ├── ProcessPool.ts      # Java 子进程池与日志缓冲
│   │   └── CoreDownloader.ts   # 核心版本获取与 jar 下载
│   └── mod/ModManager.ts       # mods 目录的上传/启停/删除
└── renderer/                   # React 渲染层
    └── src/
        ├── App.tsx
        ├── api.ts              # 前端 API / WebSocket 封装
        └── pages/
            ├── ServerList.tsx   # 服务器列表
            ├── CreateServer.tsx # 创建服务器
            └── ServerDetail.tsx # 详情：控制台 + 模组管理
```

## 主要接口

REST 基址：`http://localhost:25560/api`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/servers` | 获取服务器列表 |
| POST | `/servers` | 创建服务器（自动下载核心）|
| GET | `/servers/:id` | 获取单个服务器详情 |
| DELETE | `/servers/:id` | 删除服务器（含工作目录）|
| POST | `/servers/:id/start` | 启动 |
| POST | `/servers/:id/stop` | 停止 |
| POST | `/servers/:id/command` | 下发控制台命令 |
| GET | `/servers/:id/logs?lines=` | 获取历史日志 |
| GET | `/versions/:type` | 获取指定类型的可用版本 |
| GET/POST | `/servers/:id/mods` | 模组列表 / 上传本地模组 |
| POST | `/servers/:id/mods/:modId/toggle` | 启用 / 禁用模组 |
| DELETE | `/servers/:id/mods/:modId` | 删除模组 |

实时日志通过 WebSocket 订阅：`ws://localhost:25560/api/ws/logs/:serverId`。

## 已知限制

- **Forge / Fabric 核心安装尚未完成**：这两类核心需下载后运行 installer 才能得到可运行 jar，当前创建会提示「核心安装逻辑待实现」；Vanilla、Paper 可正常下载运行。
- 模组仅支持**本地上传 jar**，暂未接入 CurseForge / Modrinth 在线搜索安装（计划中）。
- 默认以离线模式（`online-mode=false`）初始化 `server.properties`。

## 许可证

本项目暂未指定开源许可证。
