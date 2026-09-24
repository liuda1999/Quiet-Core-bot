# BUILD_INFO

Handover package build metadata. Regenerated at packaging time; if any value here
disagrees with `git` in your working copy, trust `git`.

| Field | Value |
| --- | --- |
| Project | `openclaw` |
| Version (`package.json`) | `2026.6.11` |
| Git branch | `stage4-fix-scheduler-persistence` |
| Git commit | `df5ae4fa48dc360e2d268cd90fa74952d43fb72a` (`df5ae4fa`) |
| Commit date | `2026-09-24 10:11:51 +0800` |
| Commit subject | `fix(D-OVF-4): submit a precheck empty-transcript no-op once instead of looping to a structural overflow` |
| Tags at this commit | `stage4-fixed-v4` → `df5ae4fa`; also `stage4-fixed-v3` → `f6a17093`, `stage4-fixed-v2` → `2caaf53c` |
| Upstream remote | *(none configured in this checkout)* — upstream project: https://github.com/openclaw/openclaw |
| Package manager | `pnpm@11.2.2` (see `packageManager` in `package.json`) |
| Node engine | `>=22.19.0` (Node 24 recommended) |
| Tracked working tree | clean except 11 uncommitted docs edits (see “Uncommitted changes” below) |
| Build machine | Windows 10/11, `x64`, Node `v24.16.0`, pnpm **not installed** (Docker present) |

## Uncommitted changes in this checkout

These are documentation-only sync edits (no `src/` changes) and are included in the
package as working-tree files:

```
docs/concepts/agent-loop.md
docs/concepts/queue.md
docs/gateway/configuration-reference.md
docs/gateway/configuration.md
docs/gateway/index.md
docs/help/debugging.md
docs/reference/memory-config.md
docs/reference/session-management-compaction.md
docs/security/network-proxy.md
docs/tools/exec-approvals.md
docs/tools/subagents.md
```

To start from a pristine commit instead:

```bash
git checkout -- docs          # discard the doc sync edits
# or commit them:
git add docs && git commit -m "docs: sync project docs with the stage-4 + overflow fixes"
```

## Build artifacts

`dist/` and `dist-runtime/` are **not** shipped in this package (they are generated
by the build). Regenerate them with:

```bash
pnpm install                 # needs pnpm via corepack
pnpm build                   # → dist/
pnpm ui:build                # → dist/control-ui (Control UI)
```

The Docker path builds the same artifacts inside the image
(`pnpm build:docker` + `pnpm ui:build`, see `Dockerfile`).

## Known deviations of this checkout

- **This checkout is a post-quarantine, reduced-scope tree.** Quarantine commits
  (`72ce72ec` "batch5 (part1): quarantine A-group 111 dirs + sync R1 manifests", `a8efd81c`,
  `0b3dc077`, …) moved a large amount of the project **out of the repo**:
  - `extensions/`: **81 plugins removed**, leaving **58**. All mainstream channels
    (`telegram`, `discord`, `slack`, `whatsapp`, `msteams`, `imessage`, `feishu`, `line`,
    `qqbot`, `twitch`, `zalo`, …) and most hosted providers (`openai`, `anthropic`, `google`,
    `deepseek`, `minimax`, `xai`, `mistral`, `groq`, `openrouter`, `together`, …) are gone.
  - `skills/`: the **24 third-party integration skills remain removed** (1password, notion, trello,
    github, spotify-player, gemini, openai-whisper-api, …); the 28 local/basic skills are intact
    (144 → 51 entries).
  - **`apps/` has been RESTORED into this checkout** (1,070 files ≈ 14.5 MB: macos/ios/android/
    shared/swabble/macos-mlx-tts), together with its build tooling — 38 `scripts/*` (iOS/Android/
    macOS packaging, signing, fastlane helpers), 27 `test/scripts/*`, `appcast.xml`,
    `scripts/sparkle-build.ts` — and the `package.json` `test:macos:ci` entry.
    `vendor/` (A2UI renderers) is still absent, and the iOS/Android/macOS **CI workflows** remain
    removed, so ~7 restored tests are macOS-platform-gated and fail on Windows/Linux (see HANDOVER §11.3).
  - The build manifests were synced to match the removals (`scripts/lib/official-external-plugin-catalog.json`,
    `scripts/lib/bundled-plugin-build-entries.mjs`, `package.json` files/scripts), so **copying the
    quarantined directories back does not re-enable them**.
  - The removed trees are preserved **outside the repo** on the build machine
    (`quarantine/extensions` ≈ 30.5 MB, `quarantine/apps` ≈ 14.5 MB).
  - Consequence: this package cannot serve Telegram/Slack/Discord/WhatsApp/OpenAI/Anthropic/Google/
    DeepSeek/MiniMax out of the box. See `HANDOVER.md` §15.2 for the full lists and the documented
    restore procedure.
- `Dockerfile` tolerates the missing `apps/`: the Canvas A2UI bundle step falls back to a stub
  (non-fatal, logged as `A2UI bundle: creating stub (non-fatal)`).
- `pnpm` is not installed on the machine that produced this package; the package was validated with
  Docker tooling and Node only.

## Why the package is smaller than a full-repo archive

| | Full snapshot `openclaw-06-11-深度拆解.tar.gz` (2026-08-03) | This handover package |
| --- | --- | --- |
| Compressed | 50.4 MB | **38.8 MB** |
| Entries | 21,756 | 15,145 (files) |
| `apps/` | 1,246 | 0 (quarantined) |
| `extensions/` | 7,120 (≈90+ plugins) | 2,527 (58 plugins) |
| `skills/` | 144 | 51 |
| `dist` / `node_modules` / `.git` | 0 / 0 / 0 | 0 / 0 / 0 |

The ~11.6 MB (compressed) difference is entirely the quarantined `apps/` + 81 extensions + part of
`skills/` — **not** anything the packaging step excluded.

---

_Generated for the handover package `openclaw_handover_2026.6.11_<timestamp>.tar.gz`._
