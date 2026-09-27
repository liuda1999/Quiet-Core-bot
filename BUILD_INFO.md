# BUILD_INFO

Build metadata for this checkout. Regenerated at packaging time; if any value here
disagrees with `git` in your working copy, trust `git`.

| Field                    | Value                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Project                  | `quiet-core-bot`                                                                                                                      |
| Product name             | Quiet Core bot                                                                                                                        |
| Version (`package.json`) | `0.1.0`                                                                                                                               |
| Git branch               | `master`                                                                                                                              |
| Git commit               | `f29ceed49fea28898b1ccefc1f59ca4e4612cb1a` (`f29ceed4`)                                                                               |
| Commit date              | `2026-09-25 14:54:51 +0800`                                                                                                           |
| Commit subject           | `refactor(rebrand): finish P5 brand, state-dir anchoring, and copy sweep`                                                             |
| Repository status        | independent repository; the pre-rebrand `quiet-core-bot` history is not carried over                                                        |
| Upstream remote          | _(none configured in this checkout)_ — this project started from the upstream quiet-core-bot codebase: https://github.com/liuda1999/Quiet-Core-bot |
| Package manager          | `pnpm@11.2.2` (see `packageManager` in `package.json`)                                                                                |
| Node engine              | `>=22.19.0` (Node 24 recommended)                                                                                                     |
| Build machine            | Windows 10/11, `x64`, Node `v24.16.0`, pnpm **not installed** locally (invoke via `npx pnpm`)                                         |

## Rebrand notes

- Product/CLI surface is `Quiet Core bot` / `quiet-core-bot`; the launcher is `quiet-core-bot.mjs`.
- State directory is `~/.quiet-core-bot` with `quiet-core-bot.json`; the pre-rebrand
  `~/.quiet-core-bot` directory is still read as a fallback until the new directory is
  actually initialized, and migration is available via
  `node scripts/migrate-state-dir.ts` (dry-run by default).
- The `QUIET_CORE_` environment-variable prefix and the internal `@quiet-core/*`
  workspace package ids are intentionally unchanged so running services and
  plugin SDK import specifiers keep working.
