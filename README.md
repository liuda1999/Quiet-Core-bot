<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/liuda1999/Quiet-Core-bot/main/docs/assets/quiet-core-bot-logo-text-dark.svg">
    <img src="https://raw.githubusercontent.com/liuda1999/Quiet-Core-bot/main/docs/assets/quiet-core-bot-logo-text.svg" alt="Quiet Core bot" width="500">
  </picture>
  <br>
  🐉 Quiet Core bot — 自托管个人 AI 助手
</h1>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
  <a href="https://github.com/liuda1999/Quiet-Core-bot/releases"><img src="https://img.shields.io/badge/Release-v0.1.2-2ea44f?style=for-the-badge" alt="Release"></a>
  <a href="https://github.com/liuda1999/Quiet-Core-bot"><img src="https://img.shields.io/badge/Repository-GitHub-181717?style=for-the-badge&logo=github" alt="GitHub"></a>
</p>

<p align="center">
  仓库地址：<a href="https://github.com/liuda1999/Quiet-Core-bot">https://github.com/liuda1999/Quiet-Core-bot</a>
</p>

---

## 目录

- [一、项目简介](#一项目简介)
- [二、核心能力](#二核心能力)
- [三、支持的渠道](#三支持的渠道)
- [四、仓库结构](#四仓库结构)
- [五、依赖环境](#五依赖环境)
- [六、快速开始（推荐）](#六快速开始推荐)
- [七、从源码构建与部署](#七从源码构建与部署)
- [八、服务化部署（开机自启）](#八服务化部署开机自启)
- [九、Docker 部署](#九docker-部署)
- [十、Web 控制台](#十web-控制台)
- [十一、配置指南](#十一配置指南)
- [十二、开发与测试](#十二开发与测试)
- [十三、编码与换行（避免乱码）](#十三编码与换行避免乱码)
- [十四、常见问题](#十四常见问题)
- [十五、许可证与致谢](#十五许可证与致谢)

---

## 一、项目简介

**Quiet Core bot** 是一个运行在**你自己设备上**的**自托管个人 AI 助手**（Gateway 网关 + Agent 智能体 + 原生客户端）。

它把「控制平面」（Gateway）与「助理本体」（Agent）分开：Gateway 负责连接各家聊天渠道、调度工具与技能、托管 Web 控制台；Agent 负责理解你的意图并执行任务。你在日常使用的聊天软件里和它对话，它在你自己的机器上跑，状态与数据都留在本地。

> 定位：**单用户、本地优先、常驻在线**的个人助理。不是多租户 SaaS，也不是单纯的聊天壳。
>
> **独立衍生项目声明：** 本项目基于上游 **QuietCore** 开源代码库改造而来，是一个**独立衍生项目**，已与上游**无依赖关系**：不跟踪上游版本、不向上游仓库提交、独立发布与维护。
>
> **路径与迁移说明：** 本项目使用 `~/.quiet-core-bot` 作为状态目录、`~/.quiet-core-bot/quiet-core-bot.json` 作为配置文件。旧的 `.quiet-core-bot` / `.clawdbot` 状态目录与 `quiet-core-bot.json` / `clawdbot.json` 配置文件**不再自动迁移**到新品牌路径；如需沿用旧数据，请自行手动迁移。

**核心仓库：** <https://github.com/liuda1999/Quiet-Core-bot>

---

## 二、核心能力

| 能力         | 说明                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 多渠道接入   | 用 Telegram / WhatsApp / Slack / Discord / 飞书 / 微信 等任意渠道与助理对话，每个会话独立路由                                           |
| 本地优先     | 网关、会话、记忆、工作区默认落在本机 `~/.quiet-core-bot`，数据不出本机（除非你主动调用外部 API）                                        |
| 多模型供应商 | 支持 OpenAI 兼容、OpenAI Responses、Anthropic 兼容、本地推理（Ollama / vLLM / LM Studio / llama.cpp）等，可在 Web 控制台或 CLI 动态增删 |
| 工具与技能   | 内置 exec 执行、浏览器自动化、网页抓取与搜索、媒体处理、TTS/语音、画布（Canvas）、定时任务（cron）等                                    |
| 记忆系统     | 会话临时记忆 + 长期记忆（`MEMORY.md` / `memory/`），支持「记忆整理」（Memory Consolidation，默认关闭）                                  |
| 多智能体     | 可创建相互隔离的 agent（独立工作区、凭据、路由）                                                                                        |
| Web 控制台   | 内置 Control UI：聊天、模型与代理配置、技能/工具/记忆/会话管理、日志与健康检查                                                          |
| 原生客户端   | macOS / iOS / Android / Windows 配套应用与节点能力（相机、麦克风、屏幕、Talk 语音）                                                     |
| 可编程       | 插件（plugin）与钩子（hook）机制、MCP 支持、RPC 接口、CLI 全覆盖                                                                        |

---

## 三、支持的渠道

文本在各渠道均可用；媒体与表情回应视渠道而定。完整清单见 `quiet-core-bot channels list --all`。

- **Telegram**（grammY，支持群组）· **WhatsApp**（Baileys，需二维码配对）
- **Slack**（Bolt SDK）· **Discord**（Bot API + Gateway）· **Microsoft Teams**（Bot Framework）
- **Signal**（signal-cli）· **IRC** · **SMS**（Twilio）
- **iMessage**（macOS 原生桥接）· **Google Chat** · **Feishu / 飞书**
- **Matrix** · **Mattermost** · **Nextcloud Talk** · **Synology Chat** · **Nostr** · **Tlon**（Urbit）
- **LINE** · **QQ Bot** · **Twitch** · **WeChat / 微信** · **Zalo / Zalo Personal / Zalo ClawBot** · **Yuanbao**
- **WebChat**（Gateway 内置 WebSocket 聊天界面）

> 最快的上手渠道通常是 **Telegram**（只需一个 Bot Token）；WhatsApp 需要扫码配对。

---

## 四、仓库结构

```text
.
├── src/              # 核心 TypeScript：网关、CLI、配置、Agent 运行时、渠道、插件、工具、TUI
├── ui/               # Web 控制台（Control UI，Lit + Vite）
├── extensions/       # 内置插件（各渠道、模型供应商、加密、诊断等）
├── packages/         # 工作区子包（llm-core、media-core、terminal-core、plugin-sdk 等）
├── apps/             # 原生客户端与共享库：macOS / macOS-MLX-TTS / iOS / Android / swabble / shared
├── docs/             # 项目文档（Markdown）
├── scripts/          # 构建、测试、发布、安装等工程脚本
├── test/             # 测试基础设施与全局配置
├── Dockerfile        # 容器镜像定义
├── docker-compose.yml
└── package.json      # 根包（quiet-core-bot）
```

构建产物（不纳入版本库）：

| 产物               | 说明                                                         |
| ------------------ | ------------------------------------------------------------ |
| `dist/`            | 服务端与 CLI 的打包产物（`dist/index.js` 为 CLI/网关入口）   |
| `dist/control-ui/` | 由 `ui/` 构建出的 Web 控制台静态资源（网关按请求实时提供）   |
| `dist/extensions/` | 内置插件的运行期产物与资源                                   |
| `dist-runtime/`    | 内置插件运行期 overlay（含 SDK 别名与 Windows 兼容软链回退） |

---

## 五、依赖环境

### 5.1 必需

| 依赖         | 版本要求                                      | 说明                                       |
| ------------ | --------------------------------------------- | ------------------------------------------ |
| **Node.js**  | **≥ 22.19.0**（推荐 **24.x**）                | 见 `package.json` 的 `engines.node`        |
| **Git**      | 2.40+                                         | 拉取源码、工作区版本管理                   |
| **操作系统** | macOS 12+ / Linux（glibc 2.28+）/ Windows 10+ | Windows 服务由「计划任务（schtasks）」托管 |

### 5.2 包管理器（三选一）

| 工具     | 版本                   | 备注                                             |
| -------- | ---------------------- | ------------------------------------------------ |
| **pnpm** | **11.2.2**（仓库固定） | 推荐；`corepack enable` 后会自动使用仓库声明版本 |
| npm      | Node 自带              | 可用，但工作区（workspace）体验不如 pnpm         |
| bun      | 1.1+                   | 可用                                             |

### 5.3 可选依赖

| 依赖                       | 用途                                                |
| -------------------------- | --------------------------------------------------- |
| **Docker / Podman**        | 容器化部署、沙箱执行（Sandbox）                     |
| **Python 3.10+**           | 部分脚本与技能（如 `scripts/make-logo.py`、Skills） |
| **Xcode / Android Studio** | 仅在编译 iOS / macOS / Android 原生客户端时需要     |
| **ffmpeg**                 | 音视频转码（TTS / 媒体处理）                        |
| **Tailscale**              | 外网安全访问网关（Tailnet 绑定模式）                |

### 5.4 硬件建议

- 最低：2 核 CPU / 4 GB 内存。
- 推荐：4 核以上 / 8 GB 以上内存（同时运行浏览器自动化与本地模型时更高）。
- 使用**本地大模型**（Ollama / vLLM / LM Studio）时，内存与显存需求由所选模型决定。

---

## 六、快速开始（推荐）

> **注意：npm 包尚未发布**（`registry.npmjs.org` 上查无 `quiet-core-bot`），因此当前请先从源码构建再运行（见 [七、从源码构建与部署](#七从源码构建与部署)）。

```bash
# 1) 首次：从源码构建
git clone https://github.com/liuda1999/Quiet-Core-bot.git
cd Quiet-Core-bot
corepack enable && pnpm install
pnpm build

# 2) 运行引导向导：依次完成网关、工作区、渠道、技能配置
node dist/index.js onboard

# 3) 安装并启动常驻服务（launchd / systemd / Windows 计划任务）
node dist/index.js onboard --install-daemon
```

向导结束后：

```bash
node dist/index.js gateway status     # 查看网关状态
node dist/index.js dashboard          # 打开 Web 控制台（自动带上访问令牌）
```

> 若已把 CLI 链接到全局（`npm link` 或 `pnpm link -g`），上述 `node dist/index.js` 均可简写为 `quiet-core-bot`。
> 首次连接需要**设备配对**（pairing）。控制台顶部会给出配对命令或二维码：`quiet-core-bot devices list`。

---

## 七、从源码构建与部署

适用于二次开发、离线部署或需要定制产物（如本文档所在的仓库）。

### 7.1 克隆并安装依赖

```bash
git clone https://github.com/liuda1999/Quiet-Core-bot.git
cd Quiet-Core-bot

# 推荐使用仓库声明的 pnpm 版本
corepack enable
pnpm install
```

> 无法使用 pnpm 时，也可以用 `npm install`。

### 7.2 构建全部产物

```bash
pnpm build            # 等价于：node scripts/build-all.mjs
```

该命令会依次完成：插件资源构建 → **tsdown 打包**（生成 `dist/`）→ CLI 引导校验 → 运行期后处理 → 构建信息与打戳 → **Web 控制台构建**（生成 `dist/control-ui/`）。

只重建 Web 控制台：

```bash
node scripts/ui.js build      # 等价于 pnpm ui:build
```

> 重要：网关提供的是**已构建产物** `dist/control-ui/`。只改 `ui/` 源码不重建，页面不会变化；浏览器若仍显示旧界面，请强制刷新（`Ctrl+Shift+R`）或在开发者工具中注销 Service Worker。

### 7.3 直接在源码模式运行（开发）

```bash
pnpm dev                      # 等价于：node scripts/run-node.mjs
pnpm gateway:dev              # 跳过渠道的网关开发模式
```

### 7.4 启动网关（生产/常驻）

```bash
quiet-core-bot gateway run --port 18789
```

常用参数：

| 参数                                          | 说明                      |
| --------------------------------------------- | ------------------------- |
| `--port <n>`                                  | 监听端口，默认 `18789`    |
| `--bind loopback\|lan\|tailnet\|auto\|custom` | 绑定范围，默认 `loopback` |
| `--auth token\|password\|none\|trusted-proxy` | 认证模式                  |
| `--force`                                     | 启动前杀掉占用端口的进程  |

后台跟随日志：

```bash
quiet-core-bot logs --follow
```

### 7.5 验证部署

```bash
quiet-core-bot health             # 网关健康检查
quiet-core-bot doctor             # 配置 / 网关 / 插件 / 渠道 自检与修复建议
quiet-core-bot doctor --fix       # 自动修复可修复项
```

浏览器访问控制台：<http://127.0.0.1:18789/>

---

## 八、服务化部署（开机自启）

Quiet Core bot 使用系统级服务托管网关：

| 平台    | 服务方式                                                        |
| ------- | --------------------------------------------------------------- |
| macOS   | launchd（用户级 Agent）                                         |
| Linux   | systemd（用户级 unit）                                          |
| Windows | 计划任务（schtasks，任务名 `Quiet Core Gateway`，带隐藏启动器） |

```bash
quiet-core-bot daemon install     # 安装服务并写入自启配置
quiet-core-bot daemon start       # 启动
quiet-core-bot daemon status      # 状态 + 连通性探测
quiet-core-bot daemon restart     # 重启
quiet-core-bot daemon stop        # 停止
quiet-core-bot daemon uninstall   # 卸载服务
```

> Windows 下服务通过 `%USERPROFILE%\.quiet-core-bot\gateway.cmd` 启动，并由 `gateway.vbs` 隐藏窗口运行。修改配置后需要 `daemon restart` 才会生效。

---

## 九、Docker 部署

仓库自带 `Dockerfile` 与 `docker-compose.yml`。

```bash
# 方式一：Compose（推荐）
cp .env.example .env          # 按需填写 QUIET_CORE_GATEWAY_TOKEN 等
docker compose up -d
docker compose logs -f

# 方式二：直接构建镜像
docker build -t quiet-core-bot:local .
docker run -d --name quiet-core-bot \
  -p 18789:18789 \
  -v "$HOME/.quiet-core-bot:/home/node/.quiet-core-bot" \
  quiet-core-bot:local
```

Compose 中容器内的状态、配置、工作区路径被固定为：

```text
QUIET_CORE_STATE_DIR   = /home/node/.quiet-core-bot
QUIET_CORE_CONFIG_PATH = /home/node/.quiet-core-bot/quiet-core-bot.json
QUIET_CORE_WORKSPACE_DIR = /home/node/.quiet-core-bot/workspace
```

> 提示：在容器内运行时，宿主机路径不会生效；请把持久化目录挂载到 `/home/node/.quiet-core-bot`。

---

## 十、Web 控制台

启动网关后访问 <http://127.0.0.1:18789/>，或使用：

```bash
quiet-core-bot dashboard
```

控制台主要分区：

| 分区        | 功能                                                                |
| ----------- | ------------------------------------------------------------------- |
| 聊天        | 与助理对话、查看工具调用与会话历史                                  |
| AI 与代理   | **代理模型 / 技能 / 工具 / 记忆 / 会话** 五个分区的卡片式配置与管理 |
| 模型        | 供应商与模型的增删改、连通性校验、手动刷新模型目录                  |
| 渠道        | 渠道账号配置与状态                                                  |
| 日志 / 健康 | 实时日志、诊断与健康状态                                            |
| 设置        | 网关、外观、语言（内置 19 种语言，含简体中文）等                    |

> 控制台静态资源由 `dist/control-ui/` 提供，**按请求实时读取**，无需重启网关；但改动源码后必须重新构建（见 [7.2](#72-构建全部产物)）。

---

## 十一、配置指南

### 11.1 配置文件位置

```bash
quiet-core-bot config file
```

- Linux / macOS：`~/.quiet-core-bot/quiet-core-bot.json`
- Windows：`C:\Users\<用户名>\.quiet-core-bot\quiet-core-bot.json`

### 11.2 非交互式配置

```bash
quiet-core-bot config get models.providers          # 读取
quiet-core-bot config set gateway.port 18789        # 写入
quiet-core-bot config unset models.providers.old    # 删除
quiet-core-bot config validate                      # 校验（不启动网关）
```

也可通过交互式向导：`quiet-core-bot configure`。

### 11.3 配置模型供应商（示例）

```jsonc
{
  "models": {
    "providers": {
      "my-provider": {
        "baseUrl": "http://192.168.0.10:23456/v1",
        "apiKey": "sk-***",
        "api": "openai-responses", // 或 "openai" / "anthropic"
        "models": [
          {
            "id": "my-model",
            "name": "My Model",
            "reasoning": true,
            "input": ["text"],
            "contextWindow": 200000,
            "maxTokens": 8192,
          },
        ],
      },
    },
  },
}
```

> 本地推理（Ollama / vLLM / LM Studio / llama.cpp）同样通过 `baseUrl` 指向本地服务即可。

### 11.4 配置渠道

```bash
quiet-core-bot channels add          # 交互式添加渠道账号
quiet-core-bot channels list --all    # 列出已配置 + 可安装渠道
quiet-core-bot channels status        # 渠道状态
```

---

## 十二、开发与测试

```bash
pnpm lint             # 代码检查
pnpm check            # 仓库一致性检查
pnpm test             # 全量测试（按 project 分片）
pnpm test:fast        # 快速单测
pnpm test:ui          # Web 控制台测试
pnpm test:changed     # 只跑改动相关的测试
```

运行单个测试文件：

```bash
node scripts/run-vitest.mjs run src/path/to/file.test.ts
```

TypeScript 类型检查：

```bash
node scripts/run-tsgo.mjs -p <tsconfig.json>
```

> 首次 `pnpm install` 会注册 Git 钩子（`git-hooks/pre-commit`），提交前会执行格式化与检查。

---

## 十三、编码与换行（避免乱码）

本仓库已通过 `.gitattributes` 统一文本处理，避免跨平台乱码与换行污染：

```gitattributes
* text=auto eol=lf
```

由此保证：

- **所有文本文件按 UTF-8 存取**，仓库内 16000+ 个受版本控制的文本文件均已校验为合法 UTF-8（无 GBK/GB2312 混入、无非法字节序列）。
- **换行统一为 LF**，Windows 检出时由 `core.autocrlf` 处理，提交回仓库仍是 LF，避免整文件 diff 噪音。

本地建议：

```bash
git config core.autocrlf true    # Windows 推荐
git config core.quotepath false  # 正常显示中文路径
```

排查 Windows 终端中文乱码：

```powershell
chcp 65001                       # 切到 UTF-8 代码页
$OutputEncoding = [Console]::OutputEncoding = [Text.Encoding]::UTF8
```

编辑器请统一设置为 **UTF-8（无 BOM）** + **LF**。

---

## 十四、常见问题

**Q：`quiet-core-bot` 命令找不到？**
全局安装（或 `npm link`）后新开一个终端；仍不行时执行 `quiet-core-bot doctor` 检查安装来源。若通过 `npm link`（符号链接）安装，早期版本在解析内置插件目录时可能出现告警，`v0.1.0` 已修复。

**Q：浏览器打开控制台没有界面 / 仍是旧界面？**
确认已执行构建（`pnpm build` 或 `node scripts/ui.js build`）；然后强制刷新页面，或在开发者工具 → Application → Service Workers 中注销后重新加载。

**Q：改了 `ui/` 源码但页面没变化？**
网关读取的是构建产物 `dist/control-ui/`，改源码后必须重新构建。

**Q：网关启动报端口被占用？**
`quiet-core-bot gateway run --port <其他端口> --force`。

**Q：模型调用返回 401 / 403？**
用 `quiet-core-bot models list` 与 `quiet-core-bot health` 检查凭据；确认 API Key 有效、`baseUrl` 与 `api` 适配器匹配。失效的供应商条目可用 `quiet-core-bot config unset models.providers.<id>` 清理。

**Q：Docker 沙箱报 `failed to connect to the docker API`？**
说明本机 Docker Desktop / Docker Engine 未运行。启动 Docker 后重试，或在配置中关闭沙箱（`agents.defaults.sandbox.mode`）。

**Q：Windows 服务已安装但网页打不开？**

```powershell
quiet-core-bot daemon status
Get-ScheduledTask -TaskName "Quiet Core Gateway" | Get-ScheduledTaskInfo
```

并检查 `%USERPROFILE%\.quiet-core-bot\gateway.cmd` 中的端口与 `dist\index.js` 是否存在。

---

## 十五、许可证与致谢

- 本项目以 **MIT License** 发布，详见 [LICENSE](LICENSE)。
- 第三方组件与许可声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
- 本项目基于 **QuietCore** 开源代码库进行重构与品牌化（Quiet Core bot），感谢原作者与社区贡献者。
- 更多文档见仓库 [`docs/`](docs/) 目录。

---

<p align="center">
  <sub>仓库：<a href="https://github.com/liuda1999/Quiet-Core-bot">liuda1999/Quiet-Core-bot</a> · 版本：v0.1.2</sub>
</p>
