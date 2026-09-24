# HANDOVER_EXCLUSIONS — 打包排除项与包含项说明

本文件说明交接压缩包里**包含什么、排除了什么、为什么**，以及被排除内容的获取方式。

包文件名：`openclaw_handover_2026.6.11_<YYYYMMDD_HHMM>.tar.gz`
解包后顶层目录：`openclaw/`

---

## 1. 已包含（关键内容）

| 类别 | 内容 |
| --- | --- |
| 项目源码 | `src/`、`packages/`、`extensions/`、`ui/`、`qa/`、`skills/`、`test/`、`config/`、`security/`、`patches/`、`git-hooks/`、`deploy/` |
| 依赖清单与锁 | `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`npm-shrinkwrap.json`、`.npmrc`、各子包 `package.json` |
| 配置模板 | **`.env.example`**（完整可直接使用） |
| 容器与部署 | `Dockerfile`、`docker-compose.yml`、**`docker-compose.override.example.yml`**（本包新增模板）、`.dockerignore`、`fly.toml`、`render.yaml` |
| 部署脚本 | `scripts/docker/setup.sh`（官方）、`scripts/handover/*.sh`（本包新增：`check-env.sh` / `check-health.sh` / `deploy.sh` / `start.sh` / `stop.sh` / `restart.sh` / `status.sh` / `logs.sh`） |
| 构建与测试配置 | `tsdown.config.ts`、`vitest.config.ts`、`tsconfig*.json`、`config/*`、`.github/`（CI/CD 与 Actions） |
| 文档 | `docs/`（380+ 篇）、`README.md`、`CONTRIBUTING.md`、`SECURITY.md`、`VISION.md`、`CHANGELOG.md`、`THIRD_PARTY_NOTICES.md`、`LICENSE`、`AGENTS.md`（`CLAUDE.md` 指向它） |
| 交接文档 | **`HANDOVER.md`**、**`BUILD_INFO.md`**、本文件 |

## 2. 已排除

| 排除项 | 原因 | 如何获取 |
| --- | --- | --- |
| `.git/`（约 71 MB） | 体积大；避免历史与作者信息外泄 | 当前分支/commit 已记录在 `BUILD_INFO.md` 与 `HANDOVER.md`；如需完整历史，从上游 https://github.com/openclaw/openclaw 克隆后打上对应 commit |
| `node_modules/`（含 `ui/node_modules`、`packages/*/node_modules`、`extensions/*/node_modules`） | 可由 `pnpm install` 生成，体积巨大 | 目标机执行 `pnpm install`（需 pnpm 11.2.2，见 `HANDOVER.md` §7） |
| `dist/`（约 94 MB）、`dist-runtime/`（约 18 MB） | 构建产物；Docker 路径会在镜像内重建 | `pnpm build` / `pnpm ui:build`，或 `docker compose build` |
| `.artifacts/`、`coverage/`、`**/__openclaw_vitest__/`、`.turbo/`、`.cache/`、`.pnpm-store/` | 临时/缓存 | 自动重新生成 |
| `.env` 及各 `*_API_KEY` 真实值 | **敏感信息**，不得打包 | 从 `.env.example` 复制后在本机填写（见 `HANDOVER.md` §6） |
| `*.log`、`.handover-logs/`、`.handover-run-mode` | 运行日志与本地状态 | 运行时重新生成 |
| `.vscode/` | IDE 配置（个人偏好） | 无需；自行配置 |
| 状态目录 `~/.openclaw/`（**不在仓库内**） | 含会话、转录、SQLite、凭据引用、个人数据 | 目标机从零初始化；如需迁移，从原机器的 `~/.openclaw/` 单独安全传输（**勿入版本库**） |
| 本机绝对路径文件 / 个人数据 / 生产数据 | 隐私与可移植性 | — |

> 注：`.gitignore` 与 `.dockerignore` 中还有更多运行时排除项，本清单只列与交接相关的重点。

## 3. 未包含但可能需要的额外内容

| 内容 | 说明 | 获取方式 |
| --- | --- | --- |
| `apps/`（macOS/iOS/Android 原生客户端） | **已并回本包**（1,070 文件 / ≈14.5 MB），连同其打包脚本、测试、`appcast.xml`、`sparkle-build.ts` | 已在包内；构建需 Xcode / Android SDK，且 7 个测试是 macOS 平台门控（`HANDOVER.md` §11.3） |
| `vendor/`（A2UI 第三方渲染器） | **不存在**（原仓库亦无） | 从上游获取；缺失时 Docker 构建走 Canvas A2UI **stub 回退**（非致命） |
| iOS/Android/macOS 的 **CI workflows** | part4 已删除（`macos-release` / `ios-periphery` / `codeql-macos` / `codeql-android`） | 从上游或 `211cc32d^` 取回；不影响本地部署 |
| 修复过程与验证报告 | 原机器上位于仓库**外部**目录 `analysis/`（不在版本控制内） | 向原项目成员索取该目录；`HANDOVER.md` §15.6 已概述改了哪些代码 |
| 真实模型/渠道凭据 | 敏感 | 由接管方自行申请并填入 `.env` |

## 3b. 为什么这个包比"完整仓库"小很多（quarantine 说明）

**这不是打包删减，而是仓库本身经过了 quarantine（隔离）。** 相关提交都在当前分支历史中：

```
72ce72ec batch5 (part1): quarantine A-group 111 dirs + sync R1 manifests (package.json scripts/files,
         3 official catalogs, scripts/lib sets, sidecars, tool-display resource relocated out of apps/, ...)
a8efd81c chore: drop dead codex/openai/telegram docker e2e lanes and sync stale references
0b3dc077 batch5 (part7): ... fix quarantine-caused test expectations ...
```

被移出仓库的实体（原机器保留在仓库**外部**的 `quarantine/` 目录）：

| 目录 | 内容 | 体积 | 本包是否包含 |
| --- | --- | --- | --- |
| `quarantine/extensions/` | **81 个插件**：全部主流**渠道**（telegram / discord / slack / whatsapp / msteams / imessage / feishu / line / qqbot / twitch / zalo / zalouser / googlechat / sms / google-meet / voice-call / microsoft）与**大量 provider**（openai / anthropic / google / deepseek / minimax / xai / mistral / groq / openrouter / together / cohere / qwen / moonshot / zai / cerebras / huggingface / nvidia / venice / voyage / synthetic / chutes / cloudflare-ai-gateway / vercel-ai-gateway …），以及工具/媒体插件（brave / duckduckgo / exa / tavily / perplexity / fal / pixverse / runway / elevenlabs / deepgram / …） | 30.5 MB / 4,183 文件 | ❌ 不含（仓库里没有） |
| `quarantine/apps/` | macOS / iOS / Android 原生客户端 | 14.5 MB / 1,070 文件 | ✅ **已并回本包**（连同其打包脚本 38 个 + 测试 27 个 + `appcast.xml` + `sparkle-build.ts`） |
| `quarantine/skills/` | 24 个**第三方服务集成**技能（1password / notion / trello / github / spotify-player / gemini / openai-whisper-api …） | 0.1 MB / 27 文件 | ❌ 不含（仓库内 skills 为 51 项，**28 个本地/基础技能保留**） |
| `vendor/` | A2UI 第三方渲染器 | — | ❌ 不含 |

**体积对比（同一机器实测）**

| | 完整快照 `openclaw-06-11-深度拆解.tar.gz`（2026-08-03） | 本交接包 |
| --- | --- | --- |
| 压缩后 | 50.4 MB | 见 `SHA256SUMS` / `MANIFEST.txt` |
| 条目数 | 21,756 | **16,282**（文件） |
| `apps/` 条目 | 1,246 | **1,070（已并回）** |
| `extensions/` 条目 | 7,120（≈90+ 插件） | 2,527（**58 插件**，81 个仍隔离） |
| `skills/` 条目 | 144 | 51（24 个第三方技能仍隔离） |
| `dist` / `node_modules` / `.git` | 0 / 0 / 0 | 0 / 0 / 0（**两边都没有**） |

即：**并回 `apps/` 后**，本包与完整快照的剩余差异 = 被隔离的 **81 个插件 + 24 个第三方技能**（以及 part4 删除的 CI workflows）。

**如何恢复（若确需那些渠道/provider）**

```bash
# 1) 从旧提交取回被隔离的目录（会进入工作区，未提交）
git checkout <quarantine 之前的 commit> -- extensions/telegram extensions/openai   # 按需逐个
#    或整体：git revert <quarantine 提交>   （注意冲突）

# 2) 关键：同步恢复清单，否则构建不会把它们打进去
#    - scripts/lib/official-external-plugin-catalog.json
#    - scripts/lib/official-external-channel-catalog.json
#    - scripts/lib/bundled-plugin-build-entries.mjs
#    - package.json 的 files / scripts（以及 plugins:* 相关）
# 3) 重新 pnpm install && pnpm build
```

> ⚠️ **只把目录拷回来不会生效**：仓库清单已被同步移除了这些插件，构建系统不会打包它们。
> 若不需要这些渠道/provider，**维持现状即可**——本包即为该状态，且自带 `ollama`/`lmstudio`/`vllm`/`sglang`/`llama-cpp`/`litellm` 等本地与 OpenAI 兼容 provider，以及 `matrix`/`signal`/`irc`/`mattermost`/`nextcloud-talk`/`nostr`/`tlon`/`synology-chat` 等渠道。

---

## 4. 校验

```bash
# 校验压缩包完整性（在包所在目录执行）
sha256sum -c SHA256SUMS          # Linux/macOS
shasum -a 256 -c SHA256SUMS      # macOS 备选
certutil -hashfile <tarball> SHA256   # Windows
```
