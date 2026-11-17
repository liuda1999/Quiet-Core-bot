# BUILD_INFO

Build metadata for this checkout. Regenerated at packaging time; if any value here
disagrees with `git` in your working copy, trust `git`.

| Field                    | Value                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project                  | `quiet-core-bot`                                                                                                                                   |
| Product name             | Quiet Core bot                                                                                                                                     |
| Version (`package.json`) | `0.2.1`                                                                                                                                            |
| Git branch               | `main`                                                                                                                                             |
| Git commit               | `d9d8083732b5642324a885eb46f96ba7405c774b` (`d9d80837`)                                                                                            |
| Commit date              | `2026-11-17`                                                                                                                                       |
| Commit subject           | `fix(prompt): 修正系统提示词中过时的 web 工具描述`                                                                                                 |
| Repository status        | independent repository; the pre-rebrand `quiet-core-bot` history is not carried over                                                               |
| Upstream remote          | _(none configured in this checkout)_ — this project started from the upstream quiet-core-bot codebase: https://github.com/liuda1999/Quiet-Core-bot |
| Package manager          | `pnpm@11.2.2` (see `packageManager` in `package.json`)                                                                                             |
| Node engine              | `>=22.19.0` (Node 24 recommended)                                                                                                                  |
| Build machine            | Windows 10/11, `x64`, Node `v24.16.0`, pnpm `11.2.2` installed locally                                                                             |

## Rebrand notes

- Product/CLI surface is `Quiet Core bot` / `quiet-core-bot`; the launcher is `quiet-core-bot.mjs`.
- State directory is `~/.quiet-core-bot` with `quiet-core-bot.json`. On the first
  startup after an upgrade, a pre-rebrand `~/.openclaw` state directory (with
  `openclaw.sqlite` / `openclaw-agent.sqlite`) is renamed onto the new names by
  `src/config/paths.ts` and `src/infra/legacy-openclaw-migration.ts`; only the default
  home-relative location is migrated, and an existing `~/.quiet-core-bot` always wins.
- The `QUIET_CORE_` environment-variable prefix and the internal `@quiet-core/*`
  workspace package ids are intentionally unchanged so running services and
  plugin SDK import specifiers keep working.
