# HANDOVER — Quiet Core bot 项目交接文档

> 面向对象：接管本项目的**其他智能体 / 开发者**。
> 目标：读完本文即可接手上一次未完成的收尾工作，并在本机继续部署与开发。
> 生成时间：**2026-10-03**（第二轮更新：§2.4 两个继承失败用例已修复、改动重启复测通过；此前 2026-09-24 的打包快照版已作废）。
> 编写语言：中文；代码、命令、路径、变量名保持原文。

---

## 0. 接手前必读：路径与工作区事实（最重要）

| 事实                                | 值                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| **项目真实路径**                    | `E:\Quiet-Core-bot`                                                               |
| 所有命令 / 编辑 / 绝对路径引用      | **一律使用 `E:\Quiet-Core-bot`**                                                  |
| 旧工作区 `e:\OpenClaw`              | **已被删除，永远不会再使用**（2026-10-03 实测 `Test-Path e:\OpenClaw` = `False`） |
| 旧联接 `e:\OpenClaw\Quiet-Core-bot` | **已随工作区一并消失**（实测 `False`），不要再引用、不要重建                      |

为什么必须写清楚这一段：

- 该联接原本是指向 `E:\Quiet-Core-bot` 的 NTFS Junction。上一轮智能体所在工作区被限制为「只能编辑工作区内的路径」，因此被迫绕道 `e:\OpenClaw\Quiet-Core-bot` 去改真实项目。这产生了大量无意义的路径联动：IDE 把该联接下的跟踪文件批量标记为「已删除」，命令与文件引用在两个等价路径间来回切换。
- **接手时请直接把工作区指向 `E:\Quiet-Core-bot`**。不要创建 `e:\OpenClaw`，不要因为 IDE 报「文件被删除」而去恢复任何联接——真实文件全部完好。
- 判断方法（一条命令即可确认）：

  ```powershell
  Test-Path E:\Quiet-Core-bot      # True
  Test-Path e:\OpenClaw            # False
  ```

---

## 1. 当前仓库状态（先读）

| 项          | 值                                                                                    |
| ----------- | ------------------------------------------------------------------------------------- |
| 项目名      | Quiet Core bot（`package.json` 名 `quiet-core-bot`；仓库 `liuda1999/Quiet-Core-bot`） |
| 当前版本    | `0.1.2`（`package.json`）                                                             |
| 当前分支    | `main`                                                                                |
| HEAD        | `9e5036a9eff34dbd6b0cad61bb24d5ae6a1bd095`                                            |
| 最新 tag    | `v0.1.2`；历史 tag：`v0.1.1`、`v0.1.0`                                                |
| remote      | `origin` = https://github.com/liuda1999/Quiet-Core-bot.git（**唯一** remote）         |
| **工作区**  | **不干净：43 个已修改文件尚未提交**（详见 §1.1、§3）                                  |
| Node / pnpm | Node `>=22.19.0`（本机 `v24.16.0`）；pnpm `11.2.2`（本机已安装）                      |

### 1.1 未提交改动清单（43 项 = 19 + 19 + 5）

**A. 源头修复（5 项）**

| 文件                                        | 改动                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/agents/agent-command.ts`               | agent 停止原因日志分级（§2.1）；顺带修复了该文件既有的 `oxfmt` 未通过问题        |
| `src/commands/agent.test.ts`                | 取消 §2.4 用例的 `it.skip`，并在本文件内局部 mock 激活计划 / provider owner 解析 |
| `src/agents/harness/runtime-plugin.test.ts` | 通过 `cli-backends` 测试注入，使 CLI 别名短路可确定性验证（§2.4）                |
| `ui/src/ui/chat/chat-welcome.ts`            | 新会话默认起始选项键名替换（§2.2）                                               |
| `HANDOVER.md`                               | 本交接文档                                                                       |

**B. Web UI 多语言（19 项）**：`ui/src/i18n/locales/*.ts`（ar、de、en、es、fa、fr、id、it、ja-JP、ko、nl、pl、pt-BR、th、tr、uk、vi、zh-CN、zh-TW）

**C. i18n 派生文件（19 项）**：`ui/src/i18n/.i18n/` 下 18 个 `*.meta.json` + 1 个 `raw-copy-baseline.json`（由 `control-ui-i18n.ts sync --write` 生成）

**D. 本交接文档（1 项，已计入 A）**：`HANDOVER.md`

> 说明：B/C 是 A 的必然副产物（A 改了 UI 文案，B/C 必须同步），**必须一起提交**，否则 `ui:i18n:check` 会因基线漂移而失败。

### 1.2 历史结构（重要，避免误判）

- 本仓库自 `0.1.0` 起为**独立新历史**：`main` 只有 **15 个提交**，根提交为 `a7c35b00`（一次性导入整棵树，无父提交）。
- `v0.1.0` 标签指向**旧历史**的合并提交 `150d05a`，它**不是 `main` 的祖先**（没有任何分支包含它）。
- 因此 `git diff v0.1.0..HEAD` 会显示约 **9,700 个文件**的差异——这是历史结构造成的，**不代表当前树内容缺失**。
- 旧历史仍可通过 `v0.1.0` 标签访问；如需对照请显式使用 `v0.1.0`，不要用 `HEAD~N` 推测。
- 另一后果：仓库内文件大多只被根提交 `a7c35b00` 触碰过，`git log <file>` 往往只返回这一条。**不能用提交历史判断某缺陷是「新引入」还是「继承」**，必须用 `git stash` 做基线对照（§2.4 即如此操作）。

### 1.3 当前可运行状态（本机已实测）

- 网关以 **Windows 计划任务（schtasks）** 托管，服务定义文件 `~/.quiet-core-bot/gateway.cmd`；
  `quiet-core-bot gateway start|stop|restart|status` 可用。
- `health` 正常：`Gateway event loop: ok`。`status` 显示 `Git: main @ <sha>` 与 `app 0.1.2`。
- CLI 全矩阵、agent 单轮对话、Shell/文件工具调用、多轮上下文、cron 增删改查 + 立即执行、`infer model run` 均已跑通。
- Control UI（`ui/`）已构建到 `dist/control-ui`，浏览器端到端可用（§2.2、§2.3）。

---

## 2. 上一轮（2026-10-03）已完成的工作与证据

### 2.1 agent 日志级别修复（已完成，实测通过）

**问题**：`agent-command.ts` 中把任何非 `end_turn` 的停止原因都用 `console.error` 记成 ERROR。实际绝大多数运行以 `stop` 正常结束，导致每轮对话都产生一条 ERROR 噪音。

**改动**（`src/agents/agent-command.ts`）：

- 新增 `NORMAL_RUN_STOP_REASONS = {end_turn, stop, tool_use, toolUse, tool_calls}` → 不记录；
- 新增 `FAILED_RUN_STOP_REASONS = {error, timeout}` → `log.error`；
- 其余未知值 → `log.warn`。

**实测证据**：

1. 真实走 Gateway 链路跑一轮（`node dist/index.js agent --agent main --message ...`）：运行返回 `stopReason: "stop"`，新增 8 行日志**全为 INFO**，ERROR/WARN 各 0，**无任何 `stopReason` 行**。
2. 真实失败仍可见：模型覆盖被拒 → 仍以 **ERROR** 落盘；`--timeout 1` 造成的真实超时 → 由其它子系统以 **WARN** 暴露（`embedded run timeout`、`[run-timeout]`、`[responses] error`）并回显用户。

**复查时发现的重要细节（接手人需知）**：该日志所在的 `emitLifecycleEnd` **只在成功分支被调用**；失败一律走 `emitLifecycleResultError`，后者发出的是 `phase:"error"` 生命周期事件而非日志行。因此：

- 改动前该行对每个非 `end_turn` 结束都打 ERROR（绝大多数是正常 `stop`）→ 纯噪音；
- 改动后 `error`/`timeout` → `log.error` 这条分支实际是**防御性代码（真实失败走不到这里）**；
- 净效果：噪音清零，**错误可见性零损失**。

### 2.2 Web UI 新会话默认起始选项替换（已完成，实测通过）

**需求**：新会话默认四个起始选项中的两个替换为更实用的。

| 原选项           | 新选项                   |
| ---------------- | ------------------------ |
| 总结我最近的会话 | **创建一个本地定时任务** |
| 帮我配置一个频道 | **总结我的工作区文件**   |

（其余两个保留：你能做什么？ / 检查系统健康状况）

**改动**：`ui/src/ui/chat/chat-welcome.ts` 的 `WELCOME_SUGGESTION_KEYS`，键名
`summarizeRecentSessions → createLocalCronJob`、`configureChannel → summarizeWorkspaceFiles`；
19 个语言包同步（zh-CN 为中文文案，其余语言回退英文）。

**实测证据**（Playwright + msedge，对运行中的网关做端到端点对点）：

- 新建会话实测四个 chip：`["你能做什么？","创建一个本地定时任务","总结我的工作区文件","检查系统健康状况"]`；
- 点击「总结我的工作区文件」触发**真实 agent 运行**并返回真实工作区摘要（可见真实工具调用）；
- 控制台错误 **0**；RPC 方法集完整（`chat.send`、`sessions.create`、`health`、`models.authStatus` 等 14 个）；
- 构建产物 `dist/control-ui/assets/zh-CN-*.js` 含新文案、无旧文案；`ui:i18n:check` 退出码 0。

### 2.3 前端 ↔ 后端 RPC 契约审计（已完成）

穷举 `ui/src` 生产代码实际调用的 RPC 方法（113 个）与后端注册表（`CORE_GATEWAY_METHOD_SPECS` 209 条 + aux 11 条）逐一比对：

- **核心方法缺失：无**，全部可服务；
- **UI 监听事件 vs 后端发射：无缺口**；
- **唯一缺口（P3）**：`wiki.get` 由 `memory-wiki` 插件提供，UI 侧 `ui/src/ui/app-render.ts` 的 `openWikiPage` 未做启用门控（另两个 wiki 方法有门控）。插件默认关闭时后端返回 `unknown method`；调用处有 try/catch，降级为弹窗内联错误，**不崩溃**。
- **信息**：仓库缺少「UI 调用方法 ⊆ 后端注册表」的自动契约测试，此类断链目前只能在运行时暴露。

### 2.4 测试缺陷甄别（第二轮：两个继承失败用例均已修复）

原判「非单点可修」过于保守。两个用例失败根因相同——**临时 home 下插件注册表 / CLI 后端注册表为空**——但都可**在各自用例文件内**注入确定性测试依赖解决，无需改动共享 mock：

| 用例                                                                                                                        | 根因                                                                                              | 修复                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/agents/harness/runtime-plugin.test.ts` → `does not treat CLI backend runtime aliases as plugin ids`                    | `isCliRuntimeAliasForProvider` 依赖 CLI 后端绑定，单元测试环境未注册 `claude-cli`，别名短路未命中 | `beforeEach` 中用 `cli-backends` 的 `testing.setDepsForTest` 注入 `claude-cli → anthropic` 绑定                        |
| `src/commands/agent.test.ts` → `enables Codex, provider owner, and memory slot plugins for one-shot OpenAI model overrides` | `resolveManifestActivationPlan` 与 provider owner 解析依赖已安装清单，临时 home 下返回空          | 在本文件内以 `importOriginal` 展开后，仅覆盖 `plugins/activation-planner.js` 与 `plugins/providers.js` 的 3 个解析函数 |

- 两处均为**测试内注入**，生产代码零改动；共享 mock 文件 `src/commands/agent-command.test-mocks.ts` 未改，`agent.acp.test.ts` 不受影响。
- 处置由「跳过 + 记录」改为「修复 + 取消 `it.skip`」，仓库内已无跳过用例。
- 复测：`runtime-plugin.test.ts` 14/14；`agent.test.ts` 27/27；相邻套件 106 + 69 全通过（§10）。

补充说明：两个用例的失败**均为继承缺陷**（`git stash` 基线对照确认与本轮改动无关）；修复只增加测试注入，未放宽/改写任何断言期望值。

---

## 3. 待接手事项（按优先级）

| 优先级 | 事项                                                | 说明                                                               |
| ------ | --------------------------------------------------- | ------------------------------------------------------------------ |
| **P0** | 提交并推送 §1.1 的 43 个改动                        | 改动已验证（含 §2.4 两个用例修复），可直接提交                     |
| ~~P1~~ | **已完成**：§2.4 两个继承失败用例已修复             | 由「跳过 + 记录」改为「测试内注入 + 取消 `it.skip`」，生产代码未改 |
| **P2** | 远端 7 个 dependabot PR（#27–#33）待人工评审/合并   | 基于当前历史 `a7c35b00` / `b09f3120`，是**可合并**的依赖升级 PR    |
| **P2** | 环境相关：`web_search` 工具在本环境不可用           | 依赖联网搜索的定时任务会超时；改用本地能力或其它工具               |
| **P3** | `wiki.get` 调用未加启用门控                         | 见 §2.3，体验不一致但不崩溃                                        |
| **P3** | `docs-sync-publish.yml` 的 publish 目标仍为上游仓库 | 未配置 token 时整体跳过；配置前需先改到自有仓库                    |
| **P3** | 插件版本统一为 `0.1.0`                              | 与上游日历版本规范不符，故插件 NPM 发布改为手动触发                |

**P0 的建议提交信息**（单一提交即可，B/C 必须与 A 同提交）：

```text
fix(agent,ui): 停止原因日志分级、替换 Web 起始选项并修复两个继承失败用例

- agent: 正常停止原因（end_turn/stop/tool_use/…）不再记为 ERROR，
  失败（error/timeout）记 error，未知值记 warn；顺带修复该文件 oxfmt 未通过
- ui: 新会话默认选项「总结我最近的会话/帮我配置一个频道」替换为
  「创建一个本地定时任务/总结我的工作区文件」，同步 19 个语言包与 i18n 基线
- test: 修复两个继承失败用例并取消 it.skip —— runtime-plugin 注入 claude-cli 后端绑定，
  agent.test 局部 mock 激活计划与 provider owner 解析
- docs: 更新 HANDOVER（§2.4/§10/§11 反映修复与全量测试结论）
```

---

## 4. 最常用的命令

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

# i18n 基线（改 ui 文案后必跑，否则 ui:i18n:check 会失败）
node --import tsx scripts/control-ui-i18n.ts check
node --import tsx scripts/control-ui-i18n.ts sync --write
```

可用辅助脚本（`scripts/handover/`）：`check-env.sh`、`check-health.sh`、`deploy.sh`、`start.sh`、`stop.sh`、`restart.sh`、`status.sh`、`logs.sh`（需要 bash，Windows 上用 Git Bash / WSL）。

---

## 5. 技术栈与主要模块

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

## 6. 环境要求

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

## 7. 配置与环境变量

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

## 8. 数据与备份

| 项            | 位置 / 说明                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| SQLite        | `~/.quiet-core-bot/state/quiet-core-bot.sqlite`（schema：`src/state/quiet-core-bot-state-schema.sql`，启动时按需建表，无独立迁移命令） |
| 会话转录      | `~/.quiet-core-bot/agents/<agentId>/sessions/<sessionId>.jsonl` + `sessions.json`                                                      |
| 附件 / 工作区 | `~/.quiet-core-bot/workspace/` 及按配置落地的本地目录                                                                                  |
| 备份 / 恢复   | `node dist/index.js backup`；恢复时**先停网关**再覆盖 `~/.quiet-core-bot/`（避免 SQLite `-wal`/`-shm` 不一致）                         |
| 运行日志      | `%TEMP%\quiet-core-bot\quiet-core-bot-YYYY-MM-DD.log`（JSON 行，`_meta.logLevelName` 为级别）                                          |

---

## 9. 构建与发布

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

## 10. 测试与质量

```bash
pnpm test            # 分片入口（scripts/test-projects.mjs）
pnpm check:docs      # 文档：格式 + lint + MDX + i18n 词表 + 内链
pnpm lint            # oxlint
pnpm format:check    # oxfmt
```

第二轮（2026-10-03）本机（Windows）实测结论：

- **改动目标套件全绿**：`agent.test.ts` 27/27、`runtime-plugin.test.ts` 14/14、相邻 5 个套件 106 + 69 全部通过；`oxlint` 对改动的 3 个源文件 0 warning / 0 error；`oxfmt --check` 对改动的 4 个源文件 + `HANDOVER.md` 通过。
- **全量分片运行**（逐分片 `node scripts/run-vitest.mjs run --config <分片>`，本机、非 CI）：
  - core-unit-fast：3 failed / 10739 passed；core-unit-support：3 / 382；core-support-boundary：2 / 96；core-contracts：150 / 644；core-bundled：5 / 178；agentic：687 / 21990；auto-reply：44 / 2833；extensions：408 / 9126。
  - 失败集中在**平台/环境敏感**用例：Windows 文件权限与 owner-only 临时文件、symlink、System32 解压、POSIX `/tmp` 路径，以及需要完整 CI 环境 / 已安装插件的 plugin-contract 与 bundled 用例。
- **已用 `git stash` 基线对照排除「本轮引入」**：如 `src/plugins/contracts/session-attachments.contract.test.ts` 在 HEAD（stash 后）同样 3 项失败，与工作区一致；所有失败用例的文件与其生产源码**均不在 §1.1 改动集内**。
- **`pnpm test` 全量入口在本机会卡住**：`core-unit-ui` 分片的 `ui/src/ui/chat/chat-responsive.browser.test.ts` 运行后不结束（§11），导致该分片永不完成、后续分片不被调度 → 需逐分片运行或排除该文件。
- **`pnpm check:docs` 在本机无法运行**：`format-docs` 传给 oxfmt 的文件列表超过 Windows 命令行长度上限（`The command line is too long.`），属平台限制，与内容无关。

### 10.1 已修复：原两个继承失败用例

第二轮已将 §2.4 的两个用例修复并取消 `it.skip`（本机复测通过）：

| 用例文件                                    | 结果       | 修复手段                                                                         |
| ------------------------------------------- | ---------- | -------------------------------------------------------------------------------- |
| `src/agents/harness/runtime-plugin.test.ts` | 14/14 通过 | `beforeEach` 注入 `claude-cli → anthropic` CLI 后端绑定                          |
| `src/commands/agent.test.ts`                | 27/27 通过 | 本文件内局部覆盖 `resolveManifestActivationPlan` 与 3 个 provider-owner 解析函数 |

- 二者原为**继承失败**（`git stash` 到 HEAD 亦失败）；修复只增加测试注入，未改生产代码、未放宽断言。
- 旧处理（`it.skip` + 共享 mock 注入方案）已作废，仓库内不再有跳过用例。

---

## 11. 已知问题与风险

| 级别 | 事项                                                                   | 说明                                                                                                                                                                  |
| ---- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0   | 43 个改动未提交                                                        | 见 §1.1 与 §3；改动已完成实测                                                                                                                                         |
| P1   | `ui/src/ui/chat/chat-responsive.browser.test.ts` 在 `pnpm test` 中挂起 | 该文件启动多个 chromium 页面后不结束，使 `core-unit-ui` 分片永不完成，**其后的分片不会被调度**；单独运行同样挂起。与代码改动无关（Playwright 浏览器测试），需单独排查 |
| P2   | 远端 7 个 dependabot PR（#27–#33）待处理                               | 基于当前历史（`a7c35b00` / `b09f3120`），是**可合并的依赖升级 PR**，需人工评审/合并                                                                                   |
| P2   | 环境相关：`web_search` 工具在本环境不可用                              | 依赖联网搜索的定时任务会超时；改用本地能力或其它工具                                                                                                                  |
| P3   | `docs-sync-publish.yml` 的 publish 目标仍为上游仓库                    | 该工作流在未配置 token 时整体跳过；配置 token 前需先把 publish 目标改到自有仓库                                                                                       |
| P3   | 插件版本统一为 `0.1.0`                                                 | 与上游日历版本规范不符，故插件 NPM 发布改为手动触发                                                                                                                   |
| P3   | 表格对齐规则 MD060 已关闭                                              | oxfmt 按显示宽度对齐、MD060 按字符数计算，含全角 CJK 的表格无法同时满足，以格式化器为准（见 `config/markdownlint-cli2.jsonc` 注释）                                   |
| P3   | `wiki.get` 调用未加启用门控                                            | 见 §2.3；`memory-wiki` 默认关闭时 wiki 预览显示内联错误而非隐藏入口                                                                                                   |

安全注意：仓库内**不含任何真实密钥**（已扫描）；运行后生成的 `~/.quiet-core-bot/` 含网关 token 与 provider 凭据引用，**禁止入库**；`docker-compose.yml` 默认发布到 `0.0.0.0`，对外暴露前请改绑 `127.0.0.1` + 反向代理。

---

## 12. 交接检查清单

- [ ] 确认工作区指向 **`E:\Quiet-Core-bot`**，且 `Test-Path e:\OpenClaw` 为 `False`（不要再引用旧路径）
- [ ] `git -C E:\Quiet-Core-bot status --short` 能看到 §1.1 的 43 项改动
- [ ] `bash scripts/handover/check-env.sh` 无 `[ MISS ]`
- [ ] `pnpm install && pnpm build` 成功，`node dist/index.js --version` 显示 `0.1.2`
- [ ] `node dist/index.js gateway start` 后 `gateway status` 为 running，`health` 返回 `ok`
- [ ] `node dist/index.js agent --agent main --message "Reply with exactly: OK"` 得到模型回复
- [ ] 新增日志中**不再出现** `stopReason=stop` 的 ERROR 行；`%TEMP%\quiet-core-bot\*.log` 无真实 ERROR
- [ ] `node --import tsx scripts/control-ui-i18n.ts check` 退出码 0
- [ ] 浏览器打开 Control UI → 新建会话，四个起始选项为 §2.2 的新文案
- [ ] 按 §3 的 P0 提交并推送（B/C 与 A 同提交）
- [ ] `pnpm test` 前先确认 `ui/src/ui/chat/chat-responsive.browser.test.ts` 已排除（否则 `core-unit-ui` 分片挂起，后续分片不运行；见 §11）
- [ ] `.env` 权限 600；未把 `~/.quiet-core-bot/` 纳入版本库
- [ ] `pnpm check:docs` 通过

---

## 13. 建议优先阅读

1. 本文（尤其 §0、§1、§3）→ 2. `BUILD_INFO.md` → 3. `AGENTS.md`（仓库智能体硬性规范，改代码前必读）→ 4. `README.md` → 5. `docs/start/getting-started.md` → 6. `package.json` 的 `scripts` → 7. `CHANGELOG.md`（`0.1.1` / `0.1.2` 两节说明近期修复）。
