# HANDOVER_VERIFICATION — 交接包验证记录

> 由「项目交接与可部署打包」智能体生成。本文件随包提供，用于证明该压缩包**可迁移、无密钥、结构完整**。
> 生成时间：2026-09-24（本地 CST）。

## 1. 压缩包事实

| 项 | 值 |
| --- | --- |
| 文件名 | `quiet_core_bot_handover_2026.6.11_<YYYYMMDD_HHMM>.tar.gz`（精确文件名见同目录 `SHA256SUMS` 与 `MANIFEST.txt`） |
| 顶层目录 | `quiet-core-bot/` |
| 未压缩大小 | **≈183.3 MB** |
| 文件数 | **16,282** |
| SHA256 | 见同目录 `SHA256SUMS`（`sha256sum -c SHA256SUMS` 可校验） |
| 打包方式 | `tar -czf`（Git Bash / GNU tar），`--transform` 将顶层重命名为 `quiet-core-bot/` |

## 2. 验证结果总表

| # | 验证项 | 方法 | 结果 |
| --- | --- | --- | --- |
| 1 | 压缩包可解压 | 解压到临时目录 | ✅ 通过（`quiet-core-bot/` 顶层结构正确） |
| 2 | 必需文件在位（30 项） | 逐项 `fs.existsSync` | ✅ **30/30 通过**（`HANDOVER.md`、`BUILD_INFO.md`、`.env.example`、`Dockerfile`、`docker-compose.yml`、`docker-compose.override.example.yml`、`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`LICENSE`、`tsdown.config.ts`、`vitest.config.ts`、`scripts/docker/setup.sh`、`scripts/handover/*.sh`×8、`src/state/quiet-core-bot-state-schema.sql` 等） |
| 3 | 禁止项已排除 | 检查 `.git` / `node_modules` / `dist` / `dist-runtime` / `.vscode` / `.env` | ✅ 全部**不存在**于包内 |
| 4 | 关键 JSON 可解析 | `JSON.parse` | ✅ `package.json`、`npm-shrinkwrap.json`、`tsconfig.json` 通过（`.oxfmtrc.jsonc` 是 **JSONC**，含注释，严格解析失败属预期，非缺陷） |
| 5 | 交付脚本语法 | `bash -n`（Git Bash 5.2.37） | ✅ `scripts/handover/` 8 个脚本**全部通过**（官方 `scripts/docker/setup.sh` 亦通过） |
| 6 | `check-env.sh` 实际执行 | 在制作机运行 | ✅ 通过（exit 0）：正确报告 repo 文件、Node v24.16.0、docker 29.8.0 + compose 5.5.1、pnpm 缺失警告、`.env` 缺失警告 |
| 7 | `docker compose config` | 包内 `docker-compose.yml`（含 override 模板校验） | ✅ 通过（exit 0，语法与变量插值合法） |
| 8 | **无真实密钥** | 自研扫描器（正则库）扫描全量文本文件，覆盖 `sk-`/`sk-ant-`/`xox*`/`ghp_`/`AKIA`/`AIza`/Telegram token/含密码 DSN/PEM 私钥块 | ✅ **通过**：命中均为**测试夹具与文档示例**（如 `sk-quiet-core-bot-release-check`、`sk-docker-cron-mcp-cleanup-test`、`C:\Users\Test\...`、`/Users/user/...`），**未发现任何真实凭据** |
| 9 | **无本机绝对路径泄漏** | 同上（含 `C:\Users\<user>` 与 `/Users/<user>/` 模式） | ✅ 通过：包内不出现本包制作机的路径（`E:\QuietCore\...`）；制作者已在打包前移除源码文档中唯一一处本机路径示例 |
| 10 | 交接文档与包内文件一致 | 解析 `HANDOVER.md` 中 64 处仓库相对路径引用并逐一核对 | ✅ 通过（剩余“未命中”项均为**通配符写法**如 `src/**/*.test.ts`，或**运行期生成**文件如 `docker-compose.extra.yml`，已在文档中说明） |
| 11 | `.env.example` 完整 | 人工核对分组 | ✅ 存在且覆盖认证/provider/渠道/工具/语音（约 3.8 KB），无需新建 |

## 3. 未验证项（需在目标机器或有网环境完成）

| 项 | 原因 | 建议命令 |
| --- | --- | --- |
| `pnpm install` 真实安装 | 制作机**未安装 pnpm**（`packageManager: pnpm@11.2.2`），且安装需拉取大量依赖 | `corepack enable && corepack prepare pnpm@11.2.2 --activate && pnpm install --frozen-lockfile` |
| `docker compose build` 完整镜像构建 | 需拉取固定 sha256 的 Node/Bun 基础镜像与全部依赖，耗时且依赖外网 | `bash scripts/handover/deploy.sh`（或 `docker compose build`） |
| 容器/源码启动 + `/readyz` 端到端 | 制作机 Docker daemon 未运行 | `docker compose up -d` 后 `bash scripts/handover/check-health.sh` |
| `pnpm test` 全量 | 依赖已安装的运行环境 | `pnpm test`（预期仍有 §11.3 的 9 条既有基线失败） |
| Canvas A2UI 真产物 | 本 checkout 缺 `apps/`、`vendor/` | 补齐后 `pnpm canvas:a2ui:bundle` |

> 上述未验证项**不影响**“解压 → 补环境 → 部署”的可行性：包内 `HANDOVER.md` 已给出两条完整路径（Docker / 源码）与逐条命令。

## 4. 制作环境（仅供参考，非部署要求）

| 项 | 值 |
| --- | --- |
| OS | Windows（x64） |
| Node | v24.16.0 |
| pnpm | **未安装**（仅 corepack 存在） |
| Docker | Docker Desktop，client 29.8.0，compose 5.5.1（**daemon 未运行**） |
| bash | Git Bash 5.2.37（用于脚本校验与打包）；PATH 上的 `bash.exe` 为不可用的 WSL 存根 |
| 扫描覆盖 | 15,089 个文本文件（排除 node_modules/.git/dist 等） |

## 4b. 本次已并回的「非云端」内容（quarantine 部分回填）

用户要求「只并回非云端部分」，故已从 `72ce72ec`（part1）与其搭档提交中定向取回：

| 已并回 | 数量 | 来源 |
| --- | --- | --- |
| `apps/`（macos / ios / android / shared / swabble / macos-mlx-tts） | **1,070 文件 ≈ 14.5 MB** | `72ce72ec^` |
| iOS/Android/macOS 打包脚本（`scripts/ios-*`、`android-*`、`package-mac-*`、`codesign-*`、`create-dmg`、`notarize-*`、`restart-mac`、`scripts/lib/{ios,android,plistbuddy}` 等） | **38 文件** | `72ce72ec^` |
| 对应测试 | **27 文件** | `72ce72ec^` |
| `appcast.xml` | 1 | `72ce72ec^` |
| `scripts/sparkle-build.ts` | 1 | `d813af6c^`（part5 删除） |
| `package.json` → `scripts["test:macos:ci"]` 追加 5 个 mac 打包测试 | 1 行 | 定向还原 |

**仍未并回（按你的"去云端/第三方"要求）**：81 个插件、24 个第三方集成技能、iOS/Android/macOS 的 CI workflows（part4）。

**并回后的验证**：
- `package.json` 仍为合法 JSON ✅
- 并回的 shell 型测试：把 **Git Bash 加入 `PATH`** 后 **7/7 测试文件通过**（之前失败仅因本机 `bash` 是坏掉的 WSL 存根）✅
- 剩余 **7 个测试文件**因依赖 macOS 工具链（`codesign`/`PlistBuddy`/`hdiutil`/Xcode/fastlane）在 Windows/Linux **必然失败** → 属**平台门控**，非缺陷（详见 `HANDOVER.md` §11.3）

## 5. 已知风险提示（详见 `HANDOVER.md` §15）

1. **【最重要】本包是 quarantine（隔离）后的精简树（已部分回填）**：**81 个插件**（全部主流渠道 telegram/slack/discord/whatsapp/feishu… 与多数 hosted provider openai/anthropic/google/deepseek/minimax…）与 **24 个第三方集成技能**仍被隔离，仅保留 **58 个插件 + 28 个技能**。**若你的部署需要上述渠道/provider，本包不满足**，需按 `HANDOVER.md` §15.2 的流程恢复（并同步恢复构建清单，否则不生效）。`apps/` 已并回。
2. 包体积与"完整仓库"快照的差异**不是打包删减**：并回 `apps/` 后本包 ≈183.3 MB（未压缩）/ 16,282 文件；剩余差异来自仍被隔离的 81 插件 + 24 技能（`dist`/`node_modules`/`.git` 两边都没有）。详见 `HANDOVER_EXCLUSIONS.md` §3b。
3. 9 条既有测试失败，全部与外部 CLI 后端/MiniMax 策略有关，**不影响核心链路**；另有 7 个 **macOS 平台门控**测试在 Windows/Linux 失败（见 `HANDOVER.md` §11.3）。
4. `vendor/` 缺失：Docker 构建时 Canvas A2UI 走 stub 回退（**非致命**）。
5. `/readyz` 的 `eventLoop.degraded` 是**容量信号**，不代表就绪失败。
6. 复制 `~/.quiet-core-bot/` 迁移数据前必须**停止网关**（SQLite `-wal`/`-shm` 一致性）。
7. `~/.quiet-core-bot/quiet-core-bot.json` 及其备份族含**明文网关 token**，外传前须脱敏。
