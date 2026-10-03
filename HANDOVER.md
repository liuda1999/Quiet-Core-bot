# HANDOVER — Quiet Core bot 项目交接文档

> 面向对象：接管本项目的**其他智能体 / 开发者**。
> 目标：读完本文 + 补全环境与配置，即可在本机直接开始部署与开发。
> 生成时间：**2026-10-03**（按仓库现状重写；此前版本是 2026-09-24 的打包快照，其中版本号/分支/commit/tag 等信息已与现状不符，已作废）。
> 编写语言：中文；代码、命令、路径、变量名保持原文。

---

## 1. 仓库现状（先读）

| 项          | 值                                                                                    |
| ----------- | ------------------------------------------------------------------------------------- |
| 项目名      | Quiet Core bot（`package.json` 名 `quiet-core-bot`；仓库 `liuda1999/Quiet-Core-bot`） |
| 当前版本    | `0.1.2`（`package.json`）                                                             |
| 当前分支    | `main`                                                                                |
| remote      | `origin` = https://github.com/liuda1999/Quiet-Core-bot（**唯一** remote）             |
| 最新 tag    | `v0.1.2`；历史 tag：`v0.1.1`、`v0.1.0`                                                |
| 工作区      | 干净（`git status` 无输出）                                                           |
| Node / pnpm | Node `>=22.19.0`（本机 `v24.16.0`）；pnpm `11.2.2`（本机已安装）                      |

### 1.1 历史结构（重要，避免误判）

- 本仓库自 `0.1.0` 起为**独立新历史**：`main` 只有 **13 个提交**，根提交为 `a7c35b00`（一次性导入整棵树，无父提交）。
- `v0.1.0` 标签指向**旧历史**的合并提交 `150d05a`，它**不是 `main` 的祖先**（没有任何分支包含它）。
- 因此 `git diff v0.1.0..HEAD` 会显示约 **9,700 个文件**的差异——这是历史结构造成的，**不代表当前树内容缺失**（两棵树实际只差 40 个删除 + 少量新增）。
- 旧历史仍可通过 `v0.1.0` 标签访问；如需对照请显式使用 `v0.1.0`，不要用 `HEAD~N` 推测。

### 1.2 当前可运行状态（本机已实测）

- 网关以 **Windows 计划任务（schtasks）** 托管，服务定义文件 `~/.quiet-core-bot/gateway.cmd`；
  `quiet-core-bot gateway start|stop|restart|status` 可用。
- `health` 返回 `{"ok":true,"status":"live"}`；`status` 显示 `Git: main @ <sha>` 与 `app 0.1.2`。
- CLI 全矩阵、agent 单轮对话、Shell/文件工具调用、多轮上下文、cron 增删改查+立即执行、`infer model run` 均已跑通。

---

## 2. 最常用的命令

```bash
# 环境自检（只读，不安装任何东西）
bash scripts/handover/check-env.sh

# 依赖 / 构建 / 启动（源码方式）
corepack enable && corepack prepare pnpm@11.2.2 --activate
pnpm install
pnpm build                 # = node scripts/build-all.mjs → dist/
node dist/index.js gateway start
node dist/index.js gateway status
node dist/index.js health

# 冒烟：一轮模型调用 + 工具调用
node dist/index.js agent --agent main --message "Reply with exactly: OK"

# 文档自检（格式 / lint / MDX / i18n 词表 / 内链）
pnpm check:docs
```

可用辅助脚本（`scripts/handover/`）：`check-env.sh`、`check-health.sh`、`deploy.sh`、`start.sh`、`stop.sh`、`restart.sh`、`status.sh`、`logs.sh`（需要 bash，Windows 上用 Git Bash / WSL）。

---

## 3. 技术栈与主要模块

| 项            | 说明                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| 语言 / 运行时 | TypeScript（主），Node `>=22.19.0`                                                                     |
| 包管理        | pnpm `11.2.2`（workspace：`.`、`ui`、`packages/*`、`extensions/*`）；**不要用 npm/yarn 装根依赖**      |
| 构建          | `tsdown`（`tsdown.config.ts`）+ `scripts/build-all.mjs`；产物 `dist/`、`dist-runtime/`（**均不入库**） |
| 测试          | `vitest`，按模块分片在 `test/vitest/`（由 `scripts/test-projects.mjs` 路由）                           |
| Lint / 格式   | `oxlint`、`oxfmt`、`markdownlint-cli2`、shellcheck                                                     |
| 前端          | `ui/`（Lit + Vite）→ `dist/control-ui`                                                                 |
| 数据库        | SQLite（`node:sqlite`，无外部 DB 服务）                                                                |

| 模块         | 位置                                 | 职责                                                          |
| ------------ | ------------------------------------ | ------------------------------------------------------------- |
| Gateway      | `src/gateway/`                       | WebSocket/HTTP 服务、RPC、就绪/健康、配置热重载、运行账本     |
| Agent 运行时 | `src/agents/`                        | 单轮执行、工具循环、上下文压缩、子智能体、审批、code mode     |
| CLI          | `src/cli/`、`src/commands/`          | `quiet-core-bot ...` 全部命令                                 |
| 配置         | `src/config/`                        | zod schema、读写、校验、热重载分类                            |
| 状态         | `src/state/`、`src/config/sessions/` | SQLite schema、`agent_runs` 账本、jsonl 转录                  |
| 内置插件     | `extensions/`（**58 个**）           | provider / channel / 工具 / 记忆 / 诊断插件                   |
| 共享包       | `packages/`（**21 个**）             | `agent-core`、`gateway-protocol`、`plugin-sdk`、`llm-core` 等 |
| 技能         | `skills/`（**28 个**）               | 本地/基础技能                                                 |
| 原生客户端   | `apps/`（macOS / iOS / Android）     | **不参与** Gateway 部署；构建需 Xcode / Android SDK           |
| 文档         | `docs/`（660+ 篇 .md/.mdx）          | 入口 `docs/start/getting-started.md`                          |

---

## 4. 环境要求

| 工具                | 版本                     | 用途                                                                                |
| ------------------- | ------------------------ | ----------------------------------------------------------------------------------- |
| Node.js             | **>=22.19.0**（推荐 24） | 运行时 / 构建                                                                       |
| pnpm                | **11.2.2**               | 依赖与脚本（`corepack enable && corepack prepare pnpm@11.2.2 --activate`）          |
| git                 | 较新版                   | 版本管理                                                                            |
| bash 4+             | —                        | 运行 `scripts/**/*.sh`（Windows 用 Git Bash / WSL）                                 |
| Docker + Compose v2 | —                        | 仅容器部署路径需要（`Dockerfile`、`docker-compose.yml`、`scripts/docker/setup.sh`） |
| curl / openssl      | —                        | 健康检查 / 生成网关 token                                                           |

硬件建议：最小 2 核 / 4 GB（仅网关 + 云模型）；本地大上下文模型建议 8 核+ / 32 GB+。

---

## 5. 配置与环境变量

| 文件                 | 说明                              | 默认路径                                                                   |
| -------------------- | --------------------------------- | -------------------------------------------------------------------------- |
| 主配置               | Gateway / agent / 渠道 / provider | `~/.quiet-core-bot/quiet-core-bot.json`（`QUIET_CORE_CONFIG_PATH` 可覆盖） |
| 状态目录             | 会话、转录、SQLite、工作区        | `~/.quiet-core-bot/`（`QUIET_CORE_STATE_DIR`）                             |
| 环境变量文件         | 本地运行                          | `./.env`（已 gitignore）                                                   |
| 环境变量文件（服务） | 守护进程                          | `~/.quiet-core-bot/.env`                                                   |
| 模板                 | 变量清单                          | `.env.example`（仓库自带，覆盖认证 / provider / 渠道 / 工具 / 媒体）       |

**优先级（高 → 低）**：process env → `./.env` → `~/.quiet-core-bot/.env` → `quiet-core-bot.json` 的 `env` 块。

关键变量（**只列名称，不含任何真实值**）：

- 网关认证：`QUIET_CORE_GATEWAY_TOKEN`（或 `QUIET_CORE_GATEWAY_PASSWORD`）；非 loopback 绑定时必填，留空则首次启动自动生成。
- 路径：`QUIET_CORE_STATE_DIR`、`QUIET_CORE_CONFIG_PATH`、`QUIET_CORE_HOME`、`QUIET_CORE_AUTH_PROFILE_SECRET_DIR`。
- 模型 provider：`OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`GEMINI_API_KEY` / `GOOGLE_API_KEY`、`OPENROUTER_API_KEY` 等（至少配一个；本地模型 Ollama / LM Studio 无需 key）。
- 渠道：`TELEGRAM_BOT_TOKEN`、`DISCORD_BOT_TOKEN`、`SLACK_BOT_TOKEN` / `SLACK_APP_TOKEN`、`MATTERMOST_BOT_TOKEN` 等（只配要用的）。
- 运行时可调项：`QUIET_CORE_LOG_LEVEL`、`QUIET_CORE_LOCALE`、`QUIET_CORE_GATEWAY_URL` 等（详见 `docs/secondary-dev.md` §8.9）。

> 网关端口：代码默认 **18789**（`src/config/paths.ts` 的 `DEFAULT_GATEWAY_PORT`）；本机通过 `gateway.port` 覆盖为 **18790**。

从旧版本升级：首次启动会把 pre-rebrand 的 `~/.openclaw` 状态目录（含 `openclaw.sqlite` / `openclaw-agent.sqlite`）自动重命名到新名；仅迁移默认家目录位置，且已存在的 `~/.quiet-core-bot` 优先（见 `src/config/paths.ts` + `src/infra/legacy-openclaw-migration.ts`）。

---

## 6. 数据与备份

| 项            | 位置 / 说明                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| SQLite        | `~/.quiet-core-bot/state/quiet-core-bot.sqlite`（schema：`src/state/quiet-core-bot-state-schema.sql`，启动时按需建表，无独立迁移命令） |
| 会话转录      | `~/.quiet-core-bot/agents/<agentId>/sessions/<sessionId>.jsonl` + `sessions.json`                                                      |
| 附件 / 工作区 | `~/.quiet-core-bot/workspace/` 及按配置落地的本地目录                                                                                  |
| 备份 / 恢复   | `node dist/index.js backup`；恢复时**先停网关**再覆盖 `~/.quiet-core-bot/`（避免 SQLite `-wal`/`-shm` 不一致）                         |

---

## 7. 构建与发布

| 项         | 内容                                                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 安装依赖   | `pnpm install`（CI 用 `--frozen-lockfile`）                                                                                                   |
| 运行时构建 | `pnpm build` → `dist/`（本机实测约 95 s）                                                                                                     |
| Control UI | `pnpm ui:build` → `dist/control-ui`                                                                                                           |
| 版本 / tag | 应用版本 `0.1.x`，tag `v0.1.x`；`v0.1.2` 的 Release 已发布                                                                                    |
| 构建产物   | `dist/`、`dist-runtime/` **不入库**；`BUILD_INFO.md` 为人工维护的构建/仓库元数据                                                              |
| CI         | `.github/workflows/` 共 **50 个**；push 到 `main` 触发 CodeQL、ClawSweeper Dispatch、Docs、QuietCore Stable Main Closeout、Workflow Sanity 等 |

CI 中依赖**上游密钥/基建**的门禁（缺少对应 secret 时会**安全跳过**而不是变红，配置 secret 后自动恢复真实行为）：

| 工作流                               | 依赖                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `docker-release.yml`                 | `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`                                      |
| `control-ui-locale-refresh.yml`      | 翻译服务密钥（OpenAI / Anthropic）                                            |
| `docs-translate-trigger-release.yml` | `QUIET_CORE_DOCS_SYNC_TOKEN`                                                  |
| `docs-sync-publish.yml`              | `QUIET_CORE_DOCS_SYNC_TOKEN` + 可访问的 publish 仓库                          |
| `plugin-npm-release.yml`             | 仅手动 `workflow_dispatch` 触发（插件版本为 `0.1.0`，不符合上游日历版本规范） |

---

## 8. 测试与质量

```bash
pnpm test            # 分片入口（scripts/test-projects.mjs）
pnpm check:docs      # 文档：格式 + lint + MDX + i18n 词表 + 内链
pnpm lint            # oxlint
pnpm format:check    # oxfmt
```

本机（Windows）实测结论：

- **文档自检全绿**：`format:docs:check` 668 文件 0 变更；markdownlint 0 问题；`check-mdx` 通过；i18n 词表通过；内链 5,381 条 0 断裂。
- **核心功能测试通过**（含 `tool_search_code` code mode：`tool-search` / `tool-display` / `server-chat.agent-events` 共 236 项）。
- **已知平台/仓库差异导致的失败**（非代码缺陷，不影响本机运行）：
  - `src/skills/lifecycle/clawhub.test.ts`：3 项断言硬编码 POSIX `/tmp` 路径，在 Windows 上为 `E:\tmp\...`。
  - `test/scripts/*`：部分用例断言上游完整 CI 结构（android / ios / macos-swift 等作业），本精简发行版不适用。

---

## 9. 已知问题与风险

| 级别 | 事项                                                | 说明                                                                                                                                |
| ---- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| P2   | 远端 7 个 dependabot PR（#27–#33）待处理            | 基于当前历史（`a7c35b00` / `b09f3120`），是**可合并的依赖升级 PR**，需人工评审/合并                                                 |
| P2   | 环境相关：`web_search` 工具在本环境不可用           | 依赖联网搜索的定时任务会超时；改用本地能力或其它工具                                                                                |
| P3   | `docs-sync-publish.yml` 的 publish 目标仍为上游仓库 | 该工作流在未配置 token 时整体跳过；配置 token 前需先把 publish 目标改到自有仓库                                                     |
| P3   | 插件版本统一为 `0.1.0`                              | 与上游日历版本规范不符，故插件 NPM 发布改为手动触发                                                                                 |
| P3   | 表格对齐规则 MD060 已关闭                           | oxfmt 按显示宽度对齐、MD060 按字符数计算，含全角 CJK 的表格无法同时满足，以格式化器为准（见 `config/markdownlint-cli2.jsonc` 注释） |

安全注意：仓库内**不含任何真实密钥**（已扫描）；运行后生成的 `~/.quiet-core-bot/` 含网关 token 与 provider 凭据引用，**禁止入库**；`docker-compose.yml` 默认发布到 `0.0.0.0`，对外暴露前请改绑 `127.0.0.1` + 反向代理。

---

## 10. 交接检查清单

- [ ] `bash scripts/handover/check-env.sh` 无 `[ MISS ]`
- [ ] `pnpm install && pnpm build` 成功，`node dist/index.js --version` 显示 `0.1.2`
- [ ] `node dist/index.js gateway start` 后 `gateway status` 为 running，`health` 返回 `ok`
- [ ] `node dist/index.js agent --agent main --message "Reply with exactly: OK"` 得到模型回复
- [ ] 启动日志无 `Invalid config` / `Unknown model` / 反复 `timed out`（见 `logs.sh` 或 `%TEMP%\quiet-core-bot\*.log`）
- [ ] `.env` 权限 600；未把 `~/.quiet-core-bot/` 纳入版本库
- [ ] `pnpm check:docs` 通过

---

## 11. 建议优先阅读

1. 本文 → 2. `BUILD_INFO.md` → 3. `AGENTS.md`（仓库智能体硬性规范，改代码前必读）→ 4. `README.md` → 5. `docs/start/getting-started.md` → 6. `package.json` 的 `scripts` → 7. `CHANGELOG.md`（`0.1.1` / `0.1.2` 两节说明近期修复）。
