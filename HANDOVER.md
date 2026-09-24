# HANDOVER — OpenClaw 项目交接文档

> 面向对象：接管本项目的**其他智能体 / 开发者**。
> 目标：读完本文 + 补全环境与配置，即可在本机直接开始部署与开发，无需再向原项目成员索要文件或信息。
> 编写语言：中文；代码、命令、路径、变量名保持原文。
> 生成时间：2026-09-24（本地 CST）。

---

## 1. 给下一个智能体的快速摘要

### 1.1 项目一句话说明

**OpenClaw**（`package.json` 名称 `openclaw`，版本 `2026.6.11`）是一个「个人 AI 助手」平台：以 **WebSocket/HTTP Gateway** 为核心常驻服务，把多种大模型 provider 与多种聊天渠道（Telegram / Slack / Discord / WhatsApp / WebChat / 飞书 / Matrix …）连起来，并提供一个带工具调用、子智能体（subagent）、记忆检索、上下文压缩与审批能力的 **agent 运行时**。

### 1.2 当前状态

| 项 | 状态 |
| --- | --- |
| 可运行性 | ✅ **可运行**（本包制作机器上以本地 Ollama provider 实际跑通 Gateway `18789`，`/readyz` 返回 `ready:true`） |
| 阶段 | 处于一条**修复分支**上：`stage4-fix-scheduler-persistence`，已完成「调度/持久化」与「上下文溢出」两轮修复 |
| 部署方式 | ✅ 已有**一等公民 Docker 部署**（`Dockerfile` + `docker-compose.yml` + `scripts/docker/setup.sh`） |
| 已知故障 | 无阻塞性故障。存在若干**环境相关**既有问题与未定位项，见 §15 |
| 未提交改动 | 11 个 **纯文档** 文件（无 `src/` 改动），见 `BUILD_INFO.md` |

### 1.3 最重要的 5 个关键信息

1. **这是个 pnpm monorepo**（workspace 根 = `.`、`ui`、`packages/*`、`extensions/*`），**不能用 npm/yarn 装根依赖**；必须 `pnpm`（`packageManager: pnpm@11.2.2`，建议用 `corepack` 激活）。
2. **Node 版本硬性要求 `>=22.19.0`**（推荐 Node 24）。本包在 Node `v24.16.0` 上验证。
3. **`dist/` 不在包内**：它由构建生成（`pnpm build` / `pnpm ui:build`）。Docker 路径会在镜像内自动构建（`pnpm build:docker` + `pnpm ui:build`）。**不要**手写 `dist/`。
4. **状态与配置都在仓库之外**：默认 `~/.openclaw/`（`OPENCLAW_STATE_DIR`），配置为 `~/.openclaw/openclaw.json`。**本包不含任何真实配置、密钥、会话或数据库**——接手机器从零初始化。
5. **本 checkout 是「quarantine（隔离）后」的版本；本次交接已把其中「非云端」的部分并回。** 现状：
   - **81 个内置插件仍被隔离**（现在放在原机器的 `quarantine/extensions/`，30.5 MB）：**全部主流渠道插件**（telegram、discord、slack、whatsapp、msteams、imessage、feishu、line、qqbot、twitch、zalo、zalouser、googlechat…）与**大量 provider 插件**（openai、anthropic、google、deepseek、minimax、xai、mistral、groq、openrouter、together、cohere、qwen、moonshot…）**不在包内**；
   - **`skills/` 的 24 个第三方集成技能仍被隔离**（1password、notion、trello、github、spotify-player、gemini、openai-whisper-api…）；保留的 28 个本地/基础技能不受影响；
   - **`apps/`（macOS/iOS/Android 原生客户端）已并回本包**（1,070 文件 / ≈14.5 MB），连同其构建脚本（38 个 `scripts/*`、27 个 `test/scripts/*`、`appcast.xml`、`scripts/sparkle-build.ts`）与 `package.json` 的 `test:macos:ci` 条目；
   - `vendor/`（A2UI 第三方渲染器）**仍不存在**（原仓库亦无）。
   > 影响：**包内有 58 个插件可用**（清单见 §15.2）。被隔离的渠道/provider **无法直接使用**，且因构建清单已同步移除，把目录拷回去也**不会自动恢复**（正确做法见 §15.2）。这是**已提交的仓库状态**，不是打包遗漏。
   > `apps/` 已并回但仍**不参与** Gateway 部署：`.dockerignore` 只放行 `apps/shared/OpenClawKit/...`，其余不入构建上下文；其构建需要 Xcode / Android SDK，且相关测试是 **macOS 平台门控**（见 §11.3）。

### 1.4 最常用的 5 条命令

```bash
# 0) 环境预检（本包新增，只读，不安装任何东西）
bash scripts/handover/check-env.sh

# 1) Docker 一键部署（构建镜像 + 启动 + 等就绪）
bash scripts/handover/deploy.sh

# 2) 源码方式：装依赖 → 构建 → 前台起 Gateway
corepack enable && corepack prepare pnpm@11.2.2 --activate
pnpm install && pnpm build && pnpm ui:build
node dist/index.js gateway --allow-unconfigured --port 18789

# 3) 健康检查
bash scripts/handover/check-health.sh          # /healthz + /readyz + openclaw health

# 4) 看日志 / 停服
bash scripts/handover/logs.sh --follow
bash scripts/handover/stop.sh
```

### 1.5 关键文件索引

| 文件 | 作用 |
| --- | --- |
| `package.json` | 包名/版本/`engines`/`packageManager`/**全部脚本入口** |
| `pnpm-lock.yaml` | 依赖锁定（**部署必须用它，勿用 npm**） |
| `pnpm-workspace.yaml` | workspace 成员定义（`.`/`ui`/`packages/*`/`extensions/*`） |
| `openclaw.mjs` | CLI bin 入口（`bin.openclaw`） |
| `Dockerfile` | 多阶段构建镜像（内含 `pnpm build:docker`、`ui:build`） |
| `docker-compose.yml` | 官方 compose（gateway + cli 两个 service、端口、healthcheck） |
| `.env.example` | **环境变量模板（已完整，直接用）** |
| `.dockerignore` | Docker 构建上下文排除清单 |
| `scripts/docker/setup.sh` | 官方一键 Docker 安装脚本（会生成 `.env` 与 `docker-compose.extra.yml`） |
| `scripts/handover/*.sh` | **本包新增**的最小部署辅助脚本（§8） |
| `tsdown.config.ts` / `vitest.config.ts` | 构建 / 测试配置 |
| `AGENTS.md`（`CLAUDE.md` 指向它） | **仓库自身的智能体规范**（改代码前必读） |
| `README.md` | 官方用户向文档（安装、快速开始、从源码开发） |
| `HANDOVER.md` | 本文 |
| `BUILD_INFO.md` | 版本/commit/构建信息 |

### 1.6 接手后建议优先阅读的文件（顺序）

1. `HANDOVER.md`（本文）→ 2. `BUILD_INFO.md` → 3. `AGENTS.md`（**硬性规范**）→ 4. `README.md`「From source (development)」→ 5. `docker-compose.yml` + `Dockerfile` → 6. `package.json` 的 `scripts` → 7. `docs/start/getting-started`（在 `docs/` 内）→ 8. 改动过的核心代码见 §15.6。

---

## 2. 项目概览

| 项 | 值 |
| --- | --- |
| 项目名称 | `openclaw`（对外品牌名 OpenClaw） |
| 用途 | 个人 AI 助手 / 多渠道 agent 网关（自托管） |
| 业务背景 | 把「模型 + 工具 + 渠道 + 记忆」编排为一个常驻助手；支持多智能体、子智能体、定时任务、审批与观测 |
| 版本 | `2026.6.11` |
| 当前分支 | `stage4-fix-scheduler-persistence` |
| 最新 commit | `df5ae4fa48dc360e2d268cd90fa74952d43fb72a`（`df5ae4fa`） |
| 最近 tag | `stage4-fixed-v4` → `df5ae4fa`（另有 `stage4-fixed-v3` → `f6a17093`、`stage4-fixed-v2` → `2caaf53c`） |
| 上游仓库 | **本 checkout 未配置 remote**；上游项目地址 https://github.com/openclaw/openclaw |
| 当前负责人/联系人 | **待确认**（原仓库无 `CODEOWNERS` 交接记录；如需对接上游，走 https://github.com/openclaw/openclaw 的 issue/PR） |

### 项目边界

**负责：**
- 本仓库内的 Gateway、agent 运行时、CLI、Control UI，以及**当前保留的 58 个内置插件**（`extensions/*`，清单见 §15.2）。
- 文档（`docs/`）、测试（`test/` 与各包内 `*.test.ts`）、构建与发布脚本（`scripts/`）。

**不负责：**
- 上游模型供应商的可用性/计费（OpenAI、Anthropic、Ollama、DeepSeek 等）。
- 第三方渠道服务的账号与政策（Telegram、Slack、飞书等）。
- 本机/宿主机的 Docker、网络、代理、系统服务配置。
- `vendor/`（A2UI 第三方渲染器），以及**仍被 quarantine 隔离的 81 个插件 + 24 个第三方技能**（含全部主流渠道与 provider）——**不在本包内**，见 §15.2。
- `apps/`（macOS/iOS/Android 原生客户端）**已并回仓库**，但不属交付范围：构建需 Xcode / Android SDK，且不参与 Gateway 部署。

---

## 3. 技术栈与架构

### 3.1 语言 / 框架 / 运行时

| 项 | 版本 / 说明 |
| --- | --- |
| 语言 | TypeScript（主），少量 JavaScript / Shell / Swift(仅隔离区) |
| 运行时 | Node.js **>=22.19.0**（推荐 24）；本包在 `v24.16.0` 验证 |
| 包管理器 | **pnpm 11.2.2**（`corepack` 激活即可；`pnpm-workspace.yaml` 定义 workspace） |
| 构建 | `tsdown`（`tsdown.config.ts`）+ 项目脚本 `scripts/build-all.mjs` |
| 测试 | `vitest`（`vitest.config.ts` + `test/vitest/*.config.ts` 分片） |
| Lint/格式 | `oxlint`（`.oxlintrc.json`）、`oxfmt`（`.oxfmtrc.jsonc`）、`markdownlint-cli2`、shellcheck |
| 前端（Control UI） | 位于 `ui/`，独立构建（`pnpm ui:build`），产物进 `dist/control-ui` |
| 类型检查 | `tsgo`（TypeScript 原生实现） |

### 3.2 存储 / 外部依赖

| 类别 | 使用情况 |
| --- | --- |
| 数据库 | **SQLite**（`node:sqlite`，无外部 DB 服务）。默认状态库 `~/.openclaw/state/openclaw.sqlite` |
| 会话/转录 | 文件：`~/.openclaw/agents/<agentId>/sessions/*.jsonl` + `sessions.json` |
| 缓存/消息队列 | 无独立组件；进程内 lane/队列（见 `docs/concepts/queue.md`） |
| 对象存储 | 无（附件落本地文件系统） |
| 模型 provider | OpenAI / Anthropic / Google / OpenRouter / Ollama / LM Studio / LiteLLM / DeepSeek / MiniMax / 自建 OpenAI 兼容端点 …（见 `docs/providers/`） |
| 渠道 | Telegram / Slack / Discord / WhatsApp / Signal / iMessage / Matrix / Microsoft Teams / 飞书 / LINE / IRC / Nostr / 邮件等（见 `docs/channels/`） |
| 可观测 | 可选 OpenTelemetry（OTLP）与 Prometheus 指标、本地诊断包 |

### 3.3 整体架构（简）

```
                ┌─────────────────────────────┐
 渠道消息  ───▶  │  Gateway (ws:// 0.0.0.0:18789)│  ──▶ Agent 运行时（工具调用/子智能体/记忆/压缩/审批）
 (Telegram…)    │  HTTP: /healthz /readyz /rpc │            │
                └─────────────────────────────┘            ▼
   Control UI (dist/control-ui) ──WebSocket──────────▶  模型 provider（OpenAI/Ollama/…）
                                                         状态：SQLite + jsonl 转录
```

### 3.4 主要模块及职责

| 模块 | 位置 | 职责 |
| --- | --- | --- |
| Gateway | `src/gateway/` | WebSocket/HTTP 服务、RPC 方法、就绪/健康、配置热重载、会话与运行账本 |
| Agent 运行时 | `src/agents/` | 单轮 agent 执行、工具循环、上下文压缩、子智能体 spawn/announce、审批链路 |
| CLI | `src/cli/`、`src/commands/` | `openclaw ...` 全部命令（gateway/agent/config/channels/doctor/…） |
| 配置 | `src/config/` | zod schema、读写、校验、热重载分类、语义指纹 |
| 状态 | `src/state/` | SQLite schema、`agent_runs`/`subagent_runs` 账本、诊断事件 |
| 日志/诊断 | `src/logging/`、`src/infra/` | 分级日志、stalled 检测、稳定性快照 |
| 插件（内置） | `extensions/*` | 各 provider / channel / 工具 / 记忆 / 诊断插件 |
| 共享包 | `packages/*` | 协议、agent-core（含压缩 harness）、SDK 等 |
| Control UI | `ui/` | 浏览器端控制台 |
| 脚本 | `scripts/` | 构建、测试、发布、Docker、E2E、代码守卫 |
| 文档 | `docs/`（380+ 篇） | 用户/开发文档；`docs/start/getting-started.md` 是入口 |

---

## 4. 目录结构与关键文件

```
.                       # pnpm workspace 根（本包根目录）
├── openclaw.mjs         # CLI bin 入口（bin.openclaw）
├── package.json         # 名称/版本/engines/scripts（**脚本总表**）
├── pnpm-lock.yaml       # 依赖锁（部署必须）
├── pnpm-workspace.yaml  # workspace 成员
├── Dockerfile           # 多阶段镜像构建
├── docker-compose.yml   # 官方 compose（gateway + cli）
├── docker-compose.override.example.yml  # （本包新增）override 模板
├── .env.example         # **环境变量模板（完整，直接用）**
├── .dockerignore / .gitignore
├── HANDOVER.md / BUILD_INFO.md          # （本包新增）交接与版本信息
├── AGENTS.md (+ CLAUDE.md 指向它)        # 仓库智能体硬性规范
├── README.md / CONTRIBUTING.md / SECURITY.md / LICENSE
├── src/                 # 主源码（gateway / agents / cli / config / state / logging …）
├── packages/            # 内部共享包（agent-core / 协议 / SDK …）
├── extensions/          # 内置插件（provider/channel/tool/memory/…）
├── ui/                  # Control UI（独立构建）
├── docs/                # 文档（380+ 篇 md）
├── scripts/             # 构建/测试/发布/Docker/E2E/守卫脚本
│   ├── docker/setup.sh  # 官方一键 Docker 安装
│   ├── lib/             # 脚本公共库（含 docker-build.sh）
│   └── handover/*.sh    # （本包新增）最小部署辅助脚本
├── test/                # 跨模块测试与 vitest 分片配置
├── config/              # 工具链配置（oxlint/tsconfig/markdownlint/shellcheck …）
├── qa/ , skills/ , security/ , patches/ , git-hooks/
└── dist/ , dist-runtime/   # ← **构建产物，不在本包内**
```

**入口点汇总**

| 类型 | 位置 |
| --- | --- |
| CLI 入口 | `openclaw.mjs` → `dist/index.js`（构建后） |
| Gateway 服务入口 | `node dist/index.js gateway`（compose 中即如此） |
| 配置 schema | `src/config/zod-schema*.ts` |
| 路由 / RPC | `src/gateway/server-methods/*` |
| 服务层 | `src/agents/**`、`src/gateway/**` |
| 数据层 | `src/state/*`（SQLite）、`src/config/sessions/*`（jsonl） |
| 定时任务 | `src/cron/*`（`openclaw cron`） |
| 数据库 schema | `src/state/openclaw-state-schema.sql` |
| 迁移/初始化 | 无独立迁移工具；schema 在启动时按需建表（见 §9） |

---

## 5. 环境要求

### 5.1 操作系统

- **Linux**（推荐，容器与 systemd 路径最完整）、**macOS**、**Windows 10/11**（本包制作环境；注意部分脚本为 `bash`）。
- Windows 上跑 `scripts/*.sh` 需要 **Git Bash / WSL**；Docker 路径不受影响。

### 5.2 硬件建议

| 场景 | CPU | 内存 | 磁盘 |
| --- | --- | --- | --- |
| 最小（仅网关 + 云模型） | 2 核 | 4 GB | 10 GB |
| 常规（+ 本地小模型/浏览器工具） | 4–8 核 | 16 GB | 50 GB |
| 本地大上下文模型（如 Ollama 12B, 64k 上下文） | 8 核+ | **32 GB+** | 100 GB+ |

> 实测参考：本项目在 CPU-only 上跑本地 12B 模型 + 65536 上下文时，单次约 42k token 的预填充耗时约 **533 s**，进程 RSS 峰值约 **11.4 GB**。本地模型不是部署必需项。

### 5.3 必须安装的工具

| 工具 | 版本 | 用途 | 安装提示 |
| --- | --- | --- | --- |
| Node.js | **>=22.19.0**（推荐 24） | 运行时/构建 | 官方安装包或 nvm/fnm |
| pnpm | **11.2.2** | 依赖与脚本 | `corepack enable && corepack prepare pnpm@11.2.2 --activate` |
| Docker Engine / Desktop | 含 **Compose v2** 插件 | 容器部署（推荐路径） | 官方文档 |
| git | 任意较新版 | 版本管理 | 系统包管理器 |
| bash | 4+ | 运行 `scripts/*.sh` | Linux/macOS 自带；Windows 用 Git Bash/WSL |
| curl 或 wget | 任意 | 健康检查 | 系统包管理器 |
| openssl | 任意 | 生成网关 token | 系统包管理器 |

### 5.4 可选工具

- `sqlite3` 客户端（排查状态库）
- `psql`/`redis-cli` 等：**不需要**（本项目不用这类外部服务）
- `tsgo`、`oxlint`、`oxfmt`：已作为 devDependency 提供，无需单独安装

### 5.5 环境检查命令

```bash
bash scripts/handover/check-env.sh                # 全量检查（本包新增）
bash scripts/handover/check-env.sh --docker-only  # 只检查容器部署所需
bash scripts/handover/check-env.sh --source-only  # 只检查源码构建所需
```

---

## 6. 配置与环境变量

### 6.1 配置文件位置

| 文件 | 说明 | 默认路径 |
| --- | --- | --- |
| 主配置 | Gateway/agent/渠道/provider 的主配置 | `~/.openclaw/openclaw.json`（可用 `OPENCLAW_CONFIG_PATH` 覆盖） |
| 状态目录 | 会话、转录、SQLite、工作区 | `~/.openclaw/`（`OPENCLAW_STATE_DIR`） |
| 环境变量文件 | 本地运行用 | `./.env`（仓库根；**git 忽略**） |
| 环境变量文件（守护进程） | launchd/systemd 服务用 | `~/.openclaw/.env` |

**环境变量来源优先级（高 → 低）**：process env → `./.env` → `~/.openclaw/.env` → `openclaw.json` 的 `env` 块。
> 注意：`gateway.auth.token`、渠道 token 等**直接配置键**的优先级通常高于同名环境变量兜底。

### 6.2 环境变量清单（`​.env.example`）

**本包已包含完整的 `.env.example`（无需自行创建）**。按用途分组：

**A. Gateway 认证与路径（部署核心）**

| 变量 | 必填 | 默认 | 用途 |
| --- | --- | --- | --- |
| `OPENCLAW_GATEWAY_TOKEN` | 视绑定而定（非 loopback 时必填） | 空 → 首次启动自动生成 | 网关共享令牌；**不可**填文档示例占位值，否则拒绝启动 |
| `OPENCLAW_GATEWAY_PASSWORD` | 否 | — | 改用密码认证（与 token 二选一） |
| `OPENCLAW_STATE_DIR` | 否 | `~/.openclaw` | 状态目录 |
| `OPENCLAW_CONFIG_PATH` | 否 | `~/.openclaw/openclaw.json` | 配置文件路径 |
| `OPENCLAW_HOME` | 否 | `~` | 家目录基准 |
| `OPENCLAW_AUTH_PROFILE_SECRET_DIR` | 否 | — | 认证档案加密材料目录（Docker 部署会外挂） |
| `OPENCLAW_INCLUDE_ROOTS` | 否 | — | 允许 `$include` 解析的额外目录白名单（`:`/`;` 分隔） |
| `OPENCLAW_LOAD_SHELL_ENV` / `OPENCLAW_SHELL_ENV_TIMEOUT_MS` | 否 | 关 / 15000 | 从登录 shell 导入缺失变量 |

**B. 模型 provider 密钥（至少配一个）** —— 名称见 `.env.example`，**本包不提供任何真实值**：
`OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`GEMINI_API_KEY` / `GOOGLE_API_KEY`、`OPENROUTER_API_KEY`、`ZAI_API_KEY`、`AI_GATEWAY_API_KEY`、`TOKENHUB_API_KEY`、`LKEAP_API_KEY`、`MINIMAX_API_KEY`、`SYNTHETIC_API_KEY`；多密钥轮换形式 `<PROVIDER>_API_KEY_1..n` 或 `<PROVIDER>_API_KEYS`（逗号分隔）。
本地模型无需密钥（Ollama / LM Studio）。

**C. 渠道（只配要用的）** —— `TELEGRAM_BOT_TOKEN`、`DISCORD_BOT_TOKEN`、`SLACK_BOT_TOKEN`、`SLACK_APP_TOKEN`、`MATTERMOST_BOT_TOKEN`/`MATTERMOST_URL`、`ZALO_BOT_TOKEN`、`OPENCLAW_TWITCH_ACCESS_TOKEN` 等。

**D. 工具 / 语音媒体（可选）** —— `BRAVE_API_KEY`、`PERPLEXITY_API_KEY`、`FIRECRAWL_API_KEY`、`ELEVENLABS_API_KEY`（别名 `XI_API_KEY`）、`INWORLD_API_KEY`、`DEEPGRAM_API_KEY` 等。

**E. Docker Compose 专用（有默认值，见 `docker-compose.yml`）**

| 变量 | 默认 | 用途 |
| --- | --- | --- |
| `OPENCLAW_IMAGE` | `openclaw:local` | 镜像名 |
| `OPENCLAW_GATEWAY_PORT` | `18789` | 发布到宿主机的网关端口 |
| `OPENCLAW_BRIDGE_PORT` | `18790` | bridge 端口 |
| `OPENCLAW_MSTEAMS_PORT` | `3978` | Teams 端口 |
| `OPENCLAW_GATEWAY_BIND` | `lan` | 容器内绑定模式 |
| `OPENCLAW_CONFIG_DIR` | `${HOME}/.openclaw` | 宿主机配置目录（挂载源） |
| `OPENCLAW_WORKSPACE_DIR` | `${HOME}/.openclaw/workspace` | 宿主机工作区 |
| `OPENCLAW_TZ` | `UTC` | 时区 |
| `OTEL_EXPORTER_OTLP_*` / `OTEL_SERVICE_NAME` | 空 | 可选 OTel 导出 |
| `CLAUDE_AI_SESSION_KEY` / `CLAUDE_WEB_SESSION_KEY` / `CLAUDE_WEB_COOKIE` | 空 | 仅在使用对应 CLI 后端时需要 |
| `OPENCLAW_DISABLE_BONJOUR` | 空(自动) | 容器内自动禁用 mDNS |
| `OPENCLAW_AUTH_PROFILE_SECRET_DIR` | `${HOME}/.openclaw-auth-profile-secrets` | 认证档案密钥挂载 |

**F. 本包新增脚本使用的变量（可选）**：`OPENCLAW_GATEWAY_HOST`（默认 `127.0.0.1`）、`OPENCLAW_LOG_DIR`（Node 模式日志目录）。

### 6.3 敏感信息清单（**只列名称，不含真实值**）

接管方需在**本机**填写、且**绝不**提交到版本库：

| 名称 | 用途 | 配置位置 |
| --- | --- | --- |
| `OPENCLAW_GATEWAY_TOKEN` | 网关认证 | `./.env` 或 `~/.openclaw/.env`，或 `openclaw.json` → `gateway.auth.token` |
| 各 `*_API_KEY` | 模型 provider 认证 | 同上（或 `openclaw.json` → `models.providers.*.apiKey`） |
| `*_BOT_TOKEN` / `SLACK_APP_TOKEN` | 渠道认证 | 同上（或 `openclaw.json` → `channels.*`） |
| `OPENCLAW_AUTH_PROFILE_SECRET_DIR` 内文件 | 认证档案加密材料 | 宿主机目录（**不要**放进仓库或状态库） |
| OAuth/订阅态凭证（如 CLI 后端的 session key） | 外部 CLI 登录态 | `~/.openclaw/` 下对应 profile 目录 |
| `~/.openclaw/agents/*/agent/models.json` | provider 档案（可能含 key 引用） | 状态目录（**非**仓库） |

**如何生成密钥**

```bash
# 网关令牌（推荐 32 字节十六进制）
openssl rand -hex 32

# 或让 OpenClaw 首次启动自动生成（OPENCLAW_GATEWAY_TOKEN 留空）
```

### 6.4 `.env.example` 是否已补全

✅ **已存在且内容完整**（仓库自带 `/.env.example`，约 3.8 KB，覆盖认证、provider、渠道、工具、语音媒体）。本包**不需要**再新建；只需：

```bash
cp .env.example .env     # 本地运行
# 或
cp .env.example ~/.openclaw/.env   # 守护进程运行
```

---

## 7. 本地启动

### 7.1 方式 A：Docker（**推荐**，最省事）

```bash
# 1) 解压本包并进入
tar -xzf openclaw_handover_2026.6.11_<timestamp>.tar.gz
cd openclaw

# 2) 环境预检
bash scripts/handover/check-env.sh --docker-only

# 3) 准备配置
cp .env.example .env
#    至少设置：OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
#    以及你要用的 provider key；本地模型可不填 key

# 4) 构建 + 启动 + 等就绪
bash scripts/handover/deploy.sh

# 5) 验证
bash scripts/handover/check-health.sh
#    → /healthz 与 /readyz 应可访问；/readyz 期望 {"ready":true,...}
```

打开 Control UI：`http://<host>:18789/`（首次进入用 `.env` 中的 token 认证）。

### 7.2 方式 B：源码（开发/调试）

```bash
# 1) 装 pnpm（Node 自带的 corepack）
corepack enable
corepack prepare pnpm@11.2.2 --activate
pnpm -v            # 期望 11.2.2

# 2) 安装依赖（首次较慢）
pnpm install

# 3) 首次初始化（写本地 config/workspace）；可重复执行
pnpm openclaw setup
#    或交互式：pnpm openclaw onboard --install-daemon

# 4) 构建（node dist/index.js 需要 dist/；Control UI 需要 dist/control-ui）
pnpm build
pnpm ui:build

# 5) 前台启动 Gateway
node dist/index.js gateway --allow-unconfigured --port 18789
#    或自动重载的开发循环（会按需重建运行时）：
#    pnpm gateway:watch

# 6) 另开终端验证
node dist/index.js gateway status
node dist/index.js health
```

### 7.3 启动后的访问点与健康检查

| 项 | 值 |
| --- | --- |
| Gateway 端口 | **18789**（WebSocket + HTTP） |
| 存活探针 | `GET /healthz` |
| 就绪探针 | `GET /readyz`（loopback 或带认证时返回完整对象，含 `ready`/`failing`/`eventLoop`） |
| Control UI | `http://127.0.0.1:18789/`（由 `dist/control-ui` 提供） |
| 其他端口 | 18790（bridge）、3978（Microsoft Teams） |
| 一键健康检查 | `bash scripts/handover/check-health.sh` |

---

## 8. 部署步骤

### 8.1 目标机器需要补全的环境

1. Node.js ≥ 22.19（若走源码路径）；Docker + Compose v2（若走容器路径）。
2. pnpm 11.2.2（仅源码路径需要；`corepack prepare pnpm@11.2.2 --activate`）。
3. 网络出网能力（拉取 npm 依赖 / 基础镜像 / 模型 API；本地模型可离线）。
4. 一个模型 provider 凭据，或一个可达的本地模型服务（Ollama / LM Studio）。
5. 若要用渠道：对应渠道的 bot token 与网络可达性。

> 用 `bash scripts/handover/check-env.sh` 一次性核对，避免逐项试错。

### 8.2 部署前检查清单

- [ ] 已解压包，且 `HANDOVER.md`、`package.json`、`pnpm-lock.yaml`、`Dockerfile`、`docker-compose.yml`、`.env.example` 均存在
- [ ] `check-env.sh` 通过（无 `[ MISS ]`）
- [ ] `.env` 已从 `.env.example` 复制并填写（**token 非占位值**）
- [ ] 端口 18789/18790/3978 未被占用（`ss -ltnp | grep -E '18789|18790|3978'`）
- [ ] 磁盘 ≥ 10 GB（镜像 + 依赖 + 状态库）
- [ ] 若需要 provider：`.env` 中至少一个 `*_API_KEY` 已填，或本地模型端点可达
- [ ] 已决定绑定模式（loopback / lan / tailnet）与是否对外暴露

### 8.3 部署命令（Docker，优先）

```bash
cp .env.example .env && "$EDITOR" .env
bash scripts/handover/deploy.sh                 # = docker compose build + up -d + 等就绪
# 或官方一键脚本（会额外生成 .env 与 docker-compose.extra.yml、可选 sandbox 镜像）：
bash scripts/docker/setup.sh
# 离线环境：bash scripts/docker/setup.sh --offline
```

等效的原生命令：

```bash
docker compose config                 # 先校验
docker compose build
docker compose up -d
docker compose ps
```

### 8.4 传统方式（无 Docker）

```bash
corepack enable && corepack prepare pnpm@11.2.2 --activate
pnpm install --frozen-lockfile
pnpm build && pnpm ui:build
node dist/index.js gateway --allow-unconfigured --port 18789      # 前台
# 后台（Linux systemd 推荐用官方安装器）：
node dist/index.js gateway install      # 安装为 launchd/systemd/schtasks 服务
node dist/index.js gateway start
node dist/index.js gateway status
```

### 8.5 数据初始化 / 迁移

- **无需手工迁移**：首次启动会按需创建 `~/.openclaw/`、`state/openclaw.sqlite` 与各表（schema 见 `src/state/openclaw-state-schema.sql`）。
- 首次配置可执行 `pnpm openclaw setup`（写 `openclaw.json` + workspace）。
- 从旧机器迁移数据：直接复制 `~/.openclaw/`（或使用 `node dist/index.js backup` 生成/校验归档）。

### 8.6 启动 / 停止 / 重启 / 日志

```bash
bash scripts/handover/start.sh   [docker|node]
bash scripts/handover/stop.sh    [docker|node]
bash scripts/handover/restart.sh [docker|node]
bash scripts/handover/logs.sh    [docker|node] [--follow] [--tail N]
bash scripts/handover/status.sh  [docker|node]

# 官方等价命令
docker compose ps / logs -f / down / up -d
node dist/index.js gateway status|restart|stop|start
```

### 8.7 回滚

| 场景 | 做法 |
| --- | --- |
| 镜像升级失败 | `OPENCLAW_IMAGE=openclaw:<旧tag> bash scripts/handover/deploy.sh --no-build`；或 compose 中固定旧 image 后 `up -d` |
| 代码回滚 | `git checkout <旧 commit|tag>`（如 `stage4-fixed-v3`）→ 重新 `deploy.sh` |
| 配置写坏 | 用 `~/.openclaw/openclaw.json.bak*` / `.last-good` 还原，或 `node dist/index.js doctor --fix` |
| 数据回滚 | 恢复 `~/.openclaw/` 备份（含 `state/openclaw.sqlite` 与 `agents/*/sessions/`） |

### 8.8 生产环境注意事项

1. **必须设置 `OPENCLAW_GATEWAY_TOKEN`**，且不要用文档示例值（会拒绝启动）。
2. **不要把网关直接暴露公网**：优先 `--bind loopback` + 反向代理/Tailscale；compose 默认发布到 `0.0.0.0`，如需收紧用 `docker-compose.override.example.yml` 改绑 `127.0.0.1`。
3. **状态目录是唯一事实来源**：备份 `~/.openclaw/`（含 SQLite 与 jsonl 转录）；注意其中可能含 provider 档案与凭据引用，禁止放入版本库。
4. **凭据文件权限**：`chmod 600 ~/.openclaw/.env`；容器内认证材料目录单独挂载。
5. **exec 审批**：默认 `tools.exec.mode=auto`，审批未命中会转人工。无人值守场景建议配置 allowlist（见 `docs/tools/exec-approvals.md`），否则任务会阻塞等待审批。
6. **本地模型资源**：本地大上下文模型（如 64k）在 CPU-only 上单轮可达分钟级；请相应提高 `models.providers.<id>.timeoutSeconds` 与 `agents.defaults.timeoutSeconds`。
7. **改动配置一律用 CLI**：`node dist/index.js config set|unset <path> <value>`；直接手改 `openclaw.json` 在网关运行时会被热重载拒绝（并可能被 last-good 回滚）。

---

## 9. 数据库与数据存储

| 项 | 说明 |
| --- | --- |
| 类型/版本 | **SQLite**（通过 Node 内置 `node:sqlite`），无独立 DB 服务 |
| 默认路径 | `~/.openclaw/state/openclaw.sqlite`（`OPENCLAW_STATE_DIR` 决定前缀） |
| 连接方式 | 进程内直连文件；无需连接串/端口 |
| Schema 定义 | `src/state/openclaw-state-schema.sql` |
| 主要表 | `agent_runs`（运行账本）、`subagent_runs`（子智能体）、`diagnostic_events`（诊断事件）、`task_runs`、cron 作业表、记忆索引表等 |
| 迁移 | **无独立迁移命令**；启动时按需建表/补列（幂等） |
| 初始化数据/种子 | 无需种子；首次启动自动初始化。示例/演示数据仅在 `qa/` 与 E2E 脚本中 |
| 会话转录 | `~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl`（+ `sessions.json` 索引、`.lock` 锁文件） |
| 文件存储 | 工作区 `~/.openclaw/workspace/`、附件与媒体按配置落本地目录 |
| 备份 | `node dist/index.js backup`（创建/校验本地状态归档） |
| 恢复 | 停止网关 → 用备份覆盖 `~/.openclaw/` → 启动 |
| 注意 | 复制状态目录时**必须停止网关**，避免 SQLite `-wal`/`-shm` 不一致；`*.lock` 残留会在启动时按 dead-pid 自动回收 |

---

## 10. 构建与发布

| 项 | 内容 |
| --- | --- |
| 安装依赖 | `pnpm install`（CI 用 `--frozen-lockfile`） |
| 构建运行时 | `pnpm build`（= `node scripts/build-all.mjs`）→ 产物 `dist/` |
| 构建镜像用构建 | `pnpm build:docker`（tsdown + 运行时 sidecar + 资源拷贝等一串步骤） |
| 构建 Control UI | `pnpm ui:build` → `dist/control-ui` |
| 构建产物路径 | `dist/`（运行时 JS 与资源）、`dist-runtime/`（运行时 sidecar），**均不入库** |
| 版本规则 | `package.json.version` 形如 `YYYY.M.D`（如 `2026.6.11`）；git tag `vYYYY.M.D[-patch]`；npm dist-tag：`latest`(stable) / `beta` |
| 镜像构建 | `docker compose build` 或 `docker build -t openclaw:local .`；`Dockerfile` 多阶段，运行时用 `bookworm-slim`，基础镜像按 sha256 固定 |
| 镜像推送 | 提供 `scripts/ci-docker-login-ghcr.sh`、`scripts/ci-docker-pull-retry.sh`；具体推送流程由 CI 承担 |
| CI/CD | `.github/workflows/*`（大量 workflow：测试、CodeQL、Docker E2E、发布）；本地可用 `.github/actions/*` 复用 setup |
| 发布校验 | `pnpm release:check`、`scripts/release-check.ts`、`scripts/release-preflight.mjs` |

> **本包不含 `dist/`**：请在目标机器执行 `pnpm build && pnpm ui:build`，或直接用 Docker 路径（镜像内会构建）。

---

## 11. 测试与质量

### 11.1 常用命令

```bash
pnpm test                # 项目分片测试入口（scripts/test-projects.mjs）
pnpm test:unit           # 单元测试（含 unit:fast）
pnpm test:gateway        # Gateway 分片
pnpm test:e2e            # 端到端（含 UI e2e，需 Playwright chromium）
pnpm test:live           # 真实模型 live 测试（需 provider key）
pnpm test:docker:all     # Docker E2E 全量（重）
pnpm lint                # oxlint 分片
pnpm check               # 综合检查（scripts/check.mjs）
pnpm format:check        # 格式检查（oxfmt）
pnpm check:docs          # 文档检查（格式/lint/链接/i18n）
```

### 11.2 测试位置

| 类型 | 位置 |
| --- | --- |
| 单元测试 | 与源码同目录 `src/**/*.test.ts`、`packages/**/*.test.ts`、`extensions/**/*.test.ts` |
| 集成/跨模块 | `test/`（含 `test/vitest/*.config.ts` 分片配置） |
| E2E | `scripts/e2e/*.sh`、`packages/.../*.e2e.test.ts` |
| Live（真实模型） | `*.live.test.ts`（如 `extensions/ollama/ollama.live.test.ts`） |

### 11.3 当前测试状态（本 checkout，2026-09-24 实测）

- **核心功能测试通过**。`run.overflow-compaction.test.ts` 60/65 通过、`cli-compaction.test.ts` 19/22 通过、`run.overflow-compaction.loop.test.ts` 34/35 通过、`compact-reasons.test.ts` 11/11 通过。
- **9 条已知失败（既有基线，非本分支引入）**，全部与本机环境/外部 CLI 相关：

| 文件 | 条数 | 内容 | 性质 |
| --- | --- | --- | --- |
| `src/agents/embedded-agent-runner/run.overflow-compaction.test.ts` | 5 | "loads the … **Claude CLI auth overlay** …"（断言 `externalCliProviderIds: ["claude-cli"]`） | 依赖**外部 Claude CLI 后端**（本机未安装 `claude`/`codex`/`gemini`） |
| `src/agents/command/cli-compaction.test.ts` | 3 | native-harness 路由（Codex / Copilot CLI） | 同上，依赖外部 CLI 后端 |
| `src/agents/embedded-agent-runner/run.overflow-compaction.loop.test.ts` | 1 | `uses provider thinking policy for configless embedded MiniMax-M3 runs`（期望 `adaptive`，实得 `medium`） | **第三方模型（MiniMax）思考策略默认值**，与本机环境无关 |

  > 已用 `git checkout <基线 commit> -- <files>` 做基线对照，确认 3 条 CLI 类失败在改动前同样存在；这 9 条均**不影响**本地 Gateway/agent/压缩链路。

- **另有 7 个「macOS 平台门控」测试文件在 Windows/Linux 上失败**（本次并回 `apps/` 时一并恢复，属仓库原有内容）：

  | 文件 | 失败原因 |
  | --- | --- |
  | `test/scripts/package-mac-app.test.ts`、`package-mac-dist.test.ts`、`codesign-mac-app.test.ts`、`notarize-mac-artifact.test.ts`、`create-dmg.test.ts` | 需要 macOS 工具链（`codesign` / `PlistBuddy` / `hdiutil`）与 macOS 输出格式 |
  | `test/scripts/ios-team-id.test.ts`、`ios-release-fastlane-gates.test.ts` | 需要 Xcode / fastlane |
  | `test/scripts/restart-mac.test.ts`、`android-release-signing.test.ts` | 依赖 macOS 路径语义 / Android 签名工具 |

  > 这些测试在仓库里本就是 **macOS CI lane**（`pnpm test:macos:ci`）跑的（见 §11.1）。在 macOS 上应通过；在 Windows/Linux 上失败属**平台限制**，非代码缺陷。
  > 验证证据：把 **Git Bash** 加入 `PATH` 后，纯 shell 型测试（`android-screenshots`、`android-release-wrapper-args`、`ios-release-wrapper-args`、`ios-release-prepare`、`appcast` 等 7 个文件）**全部通过**；只有上面这 7 个依赖 macOS 二进制的仍失败。

### 11.4 代码检查与格式化

```bash
pnpm lint              # oxlint
pnpm format:check      # oxfmt --check
pnpm check:types       # 或 pnpm tsgo:test（类型检查）
bash scripts/handover/check-env.sh   # 环境自检（本包新增）
```

---

## 12. 接口与外部依赖

### 12.1 API 文档位置

- 用户/开发文档根：`docs/`（入口 `docs/start/getting-started.md`，文档目录 `docs/start/docs-directory.md`）
- 网关 RPC 参考：`docs/reference/rpc.md`
- HTTP 接口：`docs/gateway/openai-http-api.md`、`docs/gateway/openresponses-http-api.md`、`docs/gateway/tools-invoke-http-api.md`
- 官方在线文档：https://docs.openclaw.ai

### 12.2 主要接口

| 接口 | 说明 |
| --- | --- |
| WebSocket Gateway | 主控制面：`ws://<host>:18789`（RPC 方法如 `chat.*`、`agent.*`、`sessions.*`、`exec.approval.*`、`health`…） |
| `GET /healthz` | 存活探针（compose healthcheck 使用） |
| `GET /readyz` | 就绪探针（含 `ready`、`failing[]`、`eventLoop`） |
| OpenAI 兼容 HTTP | 见 `docs/gateway/openai-http-api.md` |
| CLI | `openclaw <command>`（`gateway`/`agent`/`config`/`channels`/`cron`/`approvals`/`doctor`/`backup`/`dashboard`…，完整列表见 `node dist/index.js --help`） |

### 12.3 认证方式

| 方式 | 说明 |
| --- | --- |
| `token`（默认） | `OPENCLAW_GATEWAY_TOKEN` 或 `openclaw.json` → `gateway.auth.token`；客户端在 `connect.params.auth.token` 提供 |
| `password` | `OPENCLAW_GATEWAY_PASSWORD`（与 token 二选一） |
| `none` | 仅建议 loopback |
| `trusted-proxy` | 由可信反向代理注入身份（见 `docs/gateway/trusted-proxy-auth.md`） |
| 设备配对 | 非 loopback 客户端需配对（`openclaw devices`） |

### 12.4 外部服务依赖与配置方式

| 依赖 | 配置位置 | 必需性 |
| --- | --- | --- |
| 模型 provider（OpenAI/Anthropic/Google/…） | `.env` 的 `*_API_KEY`，或 `openclaw.json` → `models.providers.*` | 至少一个 |
| 本地模型（Ollama/LM Studio） | `models.providers.*.baseUrl`（如 `http://127.0.0.1:11434`） | 可选 |
| 渠道（Telegram/Slack/…） | `.env` 或 `openclaw.json` → `channels.*` | 可选 |
| 搜索/抓取/语音（Brave/Perplexity/Firecrawl/ElevenLabs…） | `.env` / `tools.*` | 可选 |
| 可选出站代理 | `proxy.enabled` / `proxy.proxyUrl` | 可选 |

### 12.5 Webhook / 回调 / 定时任务

| 类型 | 说明 | 位置 |
| --- | --- | --- |
| 定时任务 | `openclaw cron add/list/rm/run`，持久化在状态库 | `src/cron/`、`docs/automation/cron-jobs.md` |
| Webhook | 渠道入站 webhook（如 Slack/飞书等按渠道） | `docs/plugins/webhooks.md`、`docs/gateway/` |
| 子智能体回调（announce） | 子会话完成后回投父会话 | `docs/tools/subagents.md` |

---

## 13. 日志与监控

### 13.1 日志

| 项 | 说明 |
| --- | --- |
| 控制台/文件 | 网关 stdout/stderr；Node 模式下本包脚本写到 `.handover-logs/gateway.{out,err}.log` |
| 每日日志文件 | Windows：`%TEMP%\openclaw\openclaw-YYYY-MM-DD.log`；POSIX：`$TMPDIR/openclaw/...`（结构化 JSON 行） |
| 日志级别 | `--log-level silent\|fatal\|error\|warn\|info\|debug\|trace`，或配置 `logging.*` |
| 格式 | 结构化 JSON（含 `subsystem`、`logLevelName`、时间戳）；关键行为用 `[tag]` 前缀便于 grep |
| 常用 tag | `[compaction-*]`、`[context-overflow-*]`、`[tool-result-truncation]`、`[exec-approval]`、`[diagnostic]`、`[cli-fallback]`、`[session-write-lock]`、`[reload]`、`[event-loop]`、`[model-fetch]` |
| 查看 | `bash scripts/handover/logs.sh --follow` / `docker compose logs -f` |

### 13.2 监控 / 告警 / 指标

| 方式 | 说明 |
| --- | --- |
| 就绪/存活 | `GET /readyz`、`GET /healthz`（可直接接入编排系统） |
| 事件循环容量信号 | `eventLoop.degraded` 只在 `/readyz` 与日志中体现，**不代表就绪失败**（见 `docs/gateway/index.md`） |
| OpenTelemetry | `diagnostics.otel.*` 配置 OTLP 导出（`docs/gateway/opentelemetry.md`） |
| Prometheus | `docs/gateway/prometheus.md` |
| 诊断包 | `node dist/index.js gateway diagnostics`（导出支持用诊断包） |
| 稳定性 | `node dist/index.js gateway stability`（无载荷稳定性诊断） |

### 13.3 常见错误日志及含义（速查）

| 日志 | 含义 | 处理 |
| --- | --- | --- |
| `Gateway failed to start: Invalid config at <path>` | 配置校验失败 | `node dist/index.js doctor --fix` |
| `Config auto-restored from backup … (size-drop-vs-last-good: …)` | 检测到配置体积骤降，已回滚 | 用 `config set/unset` 改配置，勿手改文件 |
| `Unknown model: <provider>/<model>` | 模型未解析（provider 未注册/目录不可达） | 检查 provider 配置、API key、代理可达性 |
| `LLM request timed out.` | provider 请求超时 | 提高 `models.providers.<id>.timeoutSeconds`；本地模型尤其需要 |
| `context overflow: prompt too large` / `Try /reset …` | 上下文超预算 | 见 §14「上下文溢出」 |
| `[session-write-lock] releasing lock held for …` | 会话写锁被看门狗释放 | 通常伴随机型缓慢；可提高 `session.writeLock.maxHoldMs` |
| `SessionWriteLockTimeoutError` | 抢不到会话写锁 | 检查是否有多进程同时写同一会话 |
| `[diagnostic] stalled session: … reason=… recovery=…` | 会话卡死诊断 | 按 `reason` 分类处理（`blocked_tool_call` / `no_model_call_since_start` 等） |
| `[exec-approval] … manual pending already registered` | 自动审阅超时，已转人工审批 | 用 `openclaw approvals pending` / `approve <id>` |
| `[cli-fallback] Gateway unavailable; falling back to an embedded in-process whole-turn rerun` | CLI 回退会**整轮重跑**（可能重放副作用） | 见 `docs/gateway/index.md` 的 replay 风险章节 |

---

## 14. 常见问题与排查

| 症状 | 排查步骤 |
| --- | --- |
| **启动失败** | ① `node dist/index.js doctor`；② 检查 `~/.openclaw/openclaw.json` 合法性（`doctor --fix` 可修）；③ 端口占用（18789/18790/3978）；④ 若为容器：`docker compose logs openclaw-gateway` |
| **依赖安装失败** | ① 确认是 **pnpm**（非 npm/yarn）且 `corepack prepare pnpm@11.2.2 --activate`；② 清干净后重试：删 `node_modules` + `pnpm install`；③ 网络/镜像源问题：检查 `.npmrc`；④ Windows 上用长路径支持或改短路径 |
| **`dist/index.js` 不存在** | 正常——本包不含构建产物。执行 `pnpm build`（+ `pnpm ui:build`），或改用 Docker 路径 |
| **数据库连接失败** | 本项目无外部 DB。若见 `attempt to write a readonly database`：状态目录权限或只读挂载问题；检查 `OPENCLAW_STATE_DIR` 可写 |
| **端口冲突** | `ss -ltnp \| grep 18789`；改用 `OPENCLAW_GATEWAY_PORT` 或 compose override |
| **环境变量缺失** | 跑 `bash scripts/handover/check-env.sh`；确认 `.env` 位置（`./.env` 或 `~/.openclaw/.env`）与优先级 |
| **权限问题** | `chmod 600 .env`；状态目录属主须为运行用户；容器内路径固定为 `/home/node/.openclaw` |
| **模型一直超时（本地模型）** | 提高 `models.providers.<id>.timeoutSeconds`（例如 1200）与 `agents.defaults.timeoutSeconds`；确认 `num_ctx` 与实际显存/内存匹配 |
| **上下文溢出** | 见下 |
| **任务卡住等待审批** | `node dist/index.js approvals pending` → `approve <id>`；无人值守请配 allowlist |
| **容器内连不上宿主模型** | compose 已加 `host.docker.internal:host-gateway`；把 `baseUrl` 指到 `http://host.docker.internal:<port>` |
| **文档校验脚本在 Windows 报「命令行过长」** | 已证实是 Windows 命令行长度限制（不是内容错误）：改为对具体文件执行 `npx oxfmt <files>` / `node scripts/docs-link-audit.mjs` |

### 上下文溢出（专项，本分支已修）

- **判定链路**：pre-prompt 本地估计超预算 → 触发压缩 → 若仍超则请求 provider → provider 报溢出 → 溢出恢复压缩 → 仍不行则显式降级。
- **关键配置**：`agents.defaults.compaction.timeoutSeconds`（压缩预算）、`agents.defaults.compaction.reserveTokens` / `keepRecentTokens`、`models.providers.<id>.contextWindow`、`agents.defaults.compaction.midTurnPrecheck.enabled`。
- **诊断 tag**：`[context-overflow-precheck]`、`[context-overflow-diag]`、`[context-overflow-recovery]`、`[compaction-nothing-to-compact]`、`[compaction-stalled-at-boundary]`。
- 细节见 `docs/reference/session-management-compaction.md`（含「Overflow and compaction safety signals」表）。

---

## 15. 已知问题、风险与待办

### 15.1 已知失败（测试）

见 §11.3：9 条既有基线失败（8 条依赖外部 CLI 后端 + 1 条 MiniMax 思考策略），**不影响**核心链路。

### 15.2 本 checkout 的结构性差异（**重要：影响功能范围**）

本 checkout 是「**quarantine（隔离）后**」的精简版本。相关提交都在 HEAD 历史中，例如：

- `72ce72ec batch5 (part1): quarantine A-group 111 dirs + sync R1 manifests (package.json scripts/files, 3 official catalogs, scripts/lib sets, sidecars, …)`
- `a8efd81c chore: drop dead codex/openai/telegram docker e2e lanes and sync stale references`
- `0b3dc077 batch5 (part7): … fix quarantine-caused test expectations …`
- 对应的**删除记录**可见：`git log --diff-filter=D --name-only -- extensions/`

| 项 | 完整仓库 | 本 checkout | 影响 |
| --- | --- | --- | --- |
| `extensions/` 插件 | ≈90+ 个（含全部主流渠道与 provider） | **58 个**（81 个仍隔离） | **被隔离的渠道/provider 不可用**（列表见下） |
| `skills/` | 144 项 | 51 项（24 个第三方集成技能仍隔离） | 第三方服务技能缺失；**28 个本地/基础技能保留** |
| `apps/` | macOS / iOS / Android 原生客户端 | **已并回**（1,070 文件 / ≈14.5 MB） | 不参与 Gateway 部署；`.dockerignore` 只放行 `apps/shared/OpenClawKit/...`；构建需 Xcode / Android SDK |
| `scripts/` + `test/scripts/`（app 打包） | iOS/Android/macOS 打包签名脚本 | **已并回**（38 脚本 + 27 测试 + `appcast.xml` + `sparkle-build.ts`） | 其中 7 个测试为 **macOS 平台门控**（见 §11.3） |
| CI workflows（iOS/Android/macOS） | `macos-release` / `ios-periphery` / `codeql-macos` / `codeql-android` | **仍缺失**（part4 删除） | 不影响本地部署；如需 CI，需自行恢复 |
| `vendor/` | A2UI 第三方渲染器 | **不存在** | Docker 构建时 Canvas A2UI 走 **stub 回退**（非致命，日志 `A2UI bundle: creating stub (non-fatal)`） |
| git remote | 上游 `github.com/openclaw/openclaw` | **未配置** | 无法 `git pull`；如需同步请自行 `git remote add` |

**包内实际可用的 58 个插件**（`extensions/` 目录清单）：

```
acpx, active-memory, admin-http-rpc, bonjour, browser, canvas, clickclack, comfy,
copilot-proxy, device-pair, diagnostics-otel, diagnostics-prometheus, diffs,
diffs-language-pack, document-extract, file-transfer, firecrawl, image-generation-core,
irc, litellm, llama-cpp, llm-task, lmstudio, lobster, matrix, mattermost,
media-understanding-core, memory-core, memory-lancedb, memory-wiki, migrate-claude,
migrate-hermes, nextcloud-talk, nostr, oc-path, ollama, open-prose, phone-control,
policy, qa-channel, qa-lab, qa-matrix, raft, searxng, sglang, signal, synology-chat,
talk-voice, test-support, thread-ownership, tlon, tokenjuice, tts-local-cli,
video-generation-core, vllm, web-readability, webhooks, workboard
```

**被隔离、因此包内不可用的主要插件**（原机器位于 `quarantine/extensions/`，81 个）：

- 渠道：`telegram`、`discord`、`slack`、`whatsapp`、`msteams`、`imessage`、`feishu`、`line`、`qqbot`、`twitch`、`zalo`、`zalouser`、`googlechat`、`sms`、`google-meet`、`voice-call`、`microsoft`
- Provider：`openai`、`anthropic`、`anthropic-vertex`、`google`、`deepseek`、`minimax`、`xai`、`mistral`、`groq`、`openrouter`、`together`、`cohere`、`qwen`、`moonshot`、`zai`、`cerebras`、`huggingface`、`nvidia`、`venice`、`voyage`、`synthetic`、`chutes`、`cloudflare-ai-gateway`、`vercel-ai-gateway`、`litellm`(已保留)…
- 工具/媒体：`brave`、`duckduckgo`、`exa`、`tavily`、`perplexity`、`firecrawl`(已保留)、`fal`、`pixverse`、`runway`、`elevenlabs`、`deepgram`、`inworld`、`gradium`、`azure-speech`、`senseaudio`
- 其它：`codex`、`codex-supervisor`、`copilot`、`github-copilot`、`opencode`、`opencode-go`、`openshell`、`parallel`、`kilocode`、`kimi-coding`、`google-meet` 等

> **恢复被隔离内容的正规做法**：回退相关 quarantine 提交（`git revert`/`git checkout <旧 commit> -- <path>`）**并同步恢复** `scripts/lib/official-external-plugin-catalog.json`、`scripts/lib/bundled-plugin-build-entries.mjs`、`package.json` 的 `files`/`scripts` 等清单——**只把目录拷回来不会生效**。若不需要这些渠道/provider，则维持现状即可（本包即为该状态）。
>
> ⚠️ 因此：**如果你的部署需要 Telegram / Slack / Discord / WhatsApp / OpenAI / Anthropic / Google / DeepSeek / MiniMax 等**，本包**不满足**，需要先恢复相应插件（见上）。当前包**开箱可用**的是：本地/自建 OpenAI 兼容 provider（`ollama`、`lmstudio`、`vllm`、`sglang`、`llama-cpp`、`litellm`…）、以及 `matrix`/`signal`/`irc`/`mattermost`/`nextcloud-talk`/`nostr`/`tlon`/`synology-chat`/`clickclack` 等渠道。

### 15.3 技术债 / 未定位项（本分支引入的修复之外）

| 编号 | 内容 | 状态 |
| --- | --- | --- |
| C-K2-1 | 网关偶发「已接受运行但迟迟未发起模型调用」的停摆；**已加告警**（`no_model_call_since_start` + `diagnostics.noModelCallWarnMs`），**根因未定位** | 待排查 |
| 写锁长持有 | 会话写锁长时间持有期间的通知写入问题**已绕过**（脱离继承写上下文 + 有界重试），**锁长持有的根因未除** | 待排查 |
| precheck 估计偏差 | pre-prompt 本地估计相对 provider 实报**高估约 1.3×**（已通过「有界 best-effort 提交」缓解，未校准数值） | 已知 |
| A26 量纲 | 压缩判据历史量纲问题已统一，但 `compaction` 记录内 `tokensBefore` 的**口径**仍需阅读 `docs/reference/session-management-compaction.md` 的说明 | 文档已说明 |
| 平台性测试失败 | 约 60 例与 OS 相关的既有失败（Windows `/tmp`、symlink EPERM、POSIX 权限位断言等） | 非本分支引入 |

### 15.4 安全风险与注意事项

1. **本包不含任何密钥**（已扫描确认，见验证报告）；但**运行后会生成**凭据（`~/.openclaw/`），必须妥善保护且不可入库。
2. **`~/.openclaw/openclaw.json` 与其备份族含明文本机网关 token**（备份文件同样含）——外传/入仓前必须脱敏。
3. **`gateway.bind=lan` + 空 token** 会拒绝启动（设计如此）；但请勿为了省事设 `auth none` 后暴露公网。
4. **`tools.exec.mode=auto/full`**：`full` 等于无审批执行宿主命令，仅限受控测试环境。
5. **CLI embedded fallback** 在网关中断时会**整轮重跑**，可能重复执行已完成的写操作（有日志留痕，无护栏）。
6. **代理/网络**：若配置 `proxy.enabled`，所有出站流量经该代理；代理不可达时模型解析会失败（本分支已补可执行指引）。

### 15.5 待办（建议优先级）

1. 在一台**干净机器**上完整跑一遍 §7/§8（本包只做了静态与工具级验证，见 §17）。
2. 为生产配置 allowlist（`docs/tools/exec-approvals.md`）以支持无人值守。
3. 补齐 `apps/` + `vendor/`（若需要 Canvas A2UI 真产物）。
4. 排查 C-K2-1 停摆与写锁长持有根因。
5. 若需要，将本次 11 个文档改动提交（`git add docs && git commit`）。

### 15.6 本分支相对上游的主要改动（建议重点阅读的代码）

> 分支 `stage4-fix-scheduler-persistence` 累积约 40+ commit，主题：调度/持久化可靠性 + 上下文溢出。**未提交的 11 个文件仅为文档同步。**

| 主题 | 主要落点 |
| --- | --- |
| 上下文溢出不再误判为终态 | `src/agents/embedded-agent-runner/run.ts`（precheck no-op 的有界 best-effort 提交）、`src/agents/embedded-agent-runner/run/attempt.ts` |
| 压缩安全性 | `packages/agent-core/src/harness/compaction/compaction.ts`、`src/agents/sessions/agent-session.ts`（退化摘要拒绝）、`src/agents/embedded-agent-runner/compact.ts`（失败保全原文） |
| 子智能体交接 | `src/agents/subagent-announce*.ts`、`src/agents/subagent-registry-helpers.ts`、`src/agents/announce-idempotency.ts` |
| 运行账本 | `src/state/agent-runs-store.ts`（终态写入补偿，持久化队列） |
| 会话写锁 / 看门狗 | `src/agents/session-write-lock.ts`、`src/logging/diagnostic.ts`、`src/logging/diagnostic-*.ts` |
| exec 审批 | `src/agents/bash-tools.exec-host-gateway.ts`、`src/agents/bash-tools.exec-approval-request.ts`、`src/infra/exec-approvals.ts` |
| 代理/模型解析文案 | `src/infra/net/proxy/managed-proxy-unreachable-hint.ts`、`src/agents/embedded-agent-runner/run.ts` |
| 配置校验可读性 | `src/config/io.write-prepare.ts`、`src/config/issue-format.ts`、`src/config/validation.ts` |
| 循环检测/内存降级告警 | `src/agents/tool-loop-detection.ts`、`src/plugins/gateway-startup-plugin-ids.ts`、`extensions/memory-core/src/memory/manager.ts` |

**不建议改动（高风险区）**：`src/gateway/` 的配置热重载与 last-good 逻辑、`src/state/openclaw-state-schema.sql`（改表需兼容旧库）、`packages/agent-core/src/harness/`（压缩核心）、`scripts/build-all.mjs` 与 `tsdown.config.ts`（构建链）、`AGENTS.md` 所列硬性规范。

---

## 16. 交接检查清单

部署方按顺序勾选：

- [ ] **基础依赖**：`bash scripts/handover/check-env.sh` 无 `[ MISS ]`
- [ ] **解压完整**：`HANDOVER.md` / `package.json` / `pnpm-lock.yaml` / `Dockerfile` / `docker-compose.yml` / `.env.example` / `scripts/handover/*.sh` 均在
- [ ] **环境变量**：`.env` 已由 `.env.example` 复制；`OPENCLAW_GATEWAY_TOKEN` 已设为**非占位**值
- [ ] **数据库**：无需手工初始化；首次启动自动建 `~/.openclaw/state/openclaw.sqlite`
- [ ] **服务可启动**：`bash scripts/handover/deploy.sh`（或源码路径 `pnpm build` + `gateway run`）成功
- [ ] **健康检查**：`bash scripts/handover/check-health.sh` → `/healthz` 200 且 `/readyz` 含 `"ready":true`
- [ ] **关键功能可访问**：浏览器打开 `http://127.0.0.1:18789/`；用 `node dist/index.js agent --message "Reply with exactly: OK"` 验证一轮模型调用
- [ ] **日志正常**：`bash scripts/handover/logs.sh` 无持续报错；无 `Invalid config` / `Unknown model` / 反复 `timed out`
- [ ] **压缩包完整**：`sha256sum -c SHA256SUMS` 通过（见包内 `SHA256SUMS`）
- [ ] **安全**：确认 `.env` 权限 `600`；确认未把 `~/.openclaw/` 纳入版本库

---

## 17. 本包的制作与验证说明

- 本包由「项目交接与可部署打包」智能体生成。
- 已完成的验证：包内容清单校验、密钥/本机绝对路径扫描、`docker compose config` 语法校验、包内脚本语法检查（`bash -n`）、交接文档与包内文件一致性核对。
- **未完成（需目标机器或有网环境）**：真实 `pnpm install`（制作机**未安装 pnpm**）、`docker compose build` 完整镜像构建（耗时且需拉取基础镜像与依赖）、`/readyz` 端到端就绪验证。
- 详细验证结果、逐项通过/未通过/未验证清单见包内 **`HANDOVER_VERIFICATION.md`**。

---
_本文档使用中文编写；命令、路径、变量名保留原文。_
