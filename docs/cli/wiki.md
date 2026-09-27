---
summary: "CLI reference for `quiet-core-bot wiki` (memory-wiki vault status, search, compile, lint, apply, bridge, and Obsidian helpers)"
read_when:
  - You want to use the memory-wiki CLI
  - You are documenting or changing `quiet-core-bot wiki`
title: "Wiki"
---

# `quiet-core-bot wiki`

Inspect and maintain the `memory-wiki` vault.

Provided by the bundled `memory-wiki` plugin.

Related:

- [Memory Wiki plugin](/plugins/memory-wiki)
- [Memory Overview](/concepts/memory)
- [CLI: memory](/cli/memory)

## What it is for

Use `quiet-core-bot wiki` when you want a compiled knowledge vault with:

- wiki-native search and page reads
- provenance-rich syntheses
- contradiction and freshness reports
- bridge imports from the active memory plugin
- optional Obsidian CLI helpers

## Common commands

```bash
quiet-core-bot wiki status
quiet-core-bot wiki doctor
quiet-core-bot wiki init
quiet-core-bot wiki ingest ./notes/alpha.md
quiet-core-bot wiki okf import ./knowledge-catalog/okf/bundles/ga4
quiet-core-bot wiki compile
quiet-core-bot wiki lint
quiet-core-bot wiki search "alpha"
quiet-core-bot wiki search "who should I ask about Teams?" --mode route-question
quiet-core-bot wiki get entity.alpha --from 1 --lines 80

quiet-core-bot wiki apply synthesis "Alpha Summary" \
  --body "Short synthesis body" \
  --source-id source.alpha

quiet-core-bot wiki apply metadata entity.alpha \
  --source-id source.alpha \
  --status review \
  --question "Still active?"

quiet-core-bot wiki bridge import
quiet-core-bot wiki unsafe-local import

quiet-core-bot wiki obsidian status
quiet-core-bot wiki obsidian search "alpha"
quiet-core-bot wiki obsidian open syntheses/alpha-summary.md
quiet-core-bot wiki obsidian command workspace:quick-switcher
quiet-core-bot wiki obsidian daily
```

## Commands

### `wiki status`

Inspect current vault mode, health, and Obsidian CLI availability.

Use this first when you are unsure whether the vault is initialized, bridge mode
is healthy, or Obsidian integration is available.

When bridge mode is active and configured to read memory artifacts, this command
queries the running Gateway so it sees the same active memory plugin context as
agent/runtime memory.

### `wiki doctor`

Run wiki health checks and surface configuration or vault problems.

When bridge mode is active and configured to read memory artifacts, this command
queries the running Gateway before building the report. Disabled bridge imports
and bridge configs that do not read memory artifacts remain local/offline.

Typical issues include:

- bridge mode enabled without public memory artifacts
- invalid or missing vault layout
- missing external Obsidian CLI when Obsidian mode is expected

### `wiki init`

Create the wiki vault layout and starter pages.

This initializes the root structure, including top-level indexes and cache
directories.

### `wiki ingest <path-or-url>`

Import content into the wiki source layer.

Notes:

- URL ingest is controlled by `ingest.allowUrlIngest`
- imported source pages keep provenance in frontmatter
- auto-compile can run after ingest when enabled

### `wiki okf import <path>`

Import an unpacked Open Knowledge Format bundle into wiki concept pages.

The importer reads every non-reserved `.md` concept document in the OKF
directory tree, requires a non-empty `type` field, and treats unknown OKF
`type` values as generic concepts. Reserved OKF `index.md` and `log.md` files
are not imported as concepts.

Imported pages are flattened under `concepts/` so existing wiki compile,
search, get, digest, and dashboard flows see them immediately. The original OKF
concept ID, `type`, `resource`, `tags`, timestamp, source path, and full
frontmatter are preserved in the page frontmatter. Internal OKF markdown links
are rewritten to the generated wiki pages; broken or external links are left
unchanged.

Examples:

```bash
quiet-core-bot wiki okf import ./bundles/ga4
quiet-core-bot wiki okf import ./bundles/ga4 --json
quiet-core-bot wiki search "BigQuery Table" --mode source-evidence --json
quiet-core-bot wiki get <path-from-json-result>
```

### `wiki compile`

Rebuild indexes, related blocks, dashboards, and compiled digests.

This writes stable machine-facing artifacts under:

- `.quiet-core-bot-wiki/cache/agent-digest.json`
- `.quiet-core-bot-wiki/cache/claims.jsonl`

If `render.createDashboards` is enabled, compile also refreshes report pages.

### `wiki lint`

Lint the vault and report:

- structural issues
- provenance gaps
- contradictions
- open questions
- low-confidence pages/claims
- stale pages/claims

Run this after meaningful wiki updates.

### `wiki search <query>`

Search wiki content.

Behavior depends on config:

- `search.backend`: `shared` or `local`
- `search.corpus`: `wiki`, `memory`, or `all`
- `--mode`: `auto`, `find-person`, `route-question`, `source-evidence`, or
  `raw-claim`

Use `wiki search` when you want wiki-specific ranking or provenance details.
For one broad shared recall pass, prefer `quiet-core-bot memory search` when the
active memory plugin exposes shared search.

Search modes help the agent choose the right surface:

- `find-person`: aliases, handles, socials, canonical IDs, and person pages
- `route-question`: ask-for/best-used-for hints and relationship context
- `source-evidence`: source pages and structured evidence fields
- `raw-claim`: structured claim text with claim/evidence metadata

Examples:

```bash
quiet-core-bot wiki search "bgroux" --mode find-person
quiet-core-bot wiki search "who knows Teams rollout?" --mode route-question
quiet-core-bot wiki search "maintainer-whois" --mode source-evidence
quiet-core-bot wiki search "strong route Teams" --mode raw-claim --json
```

Text output includes `Claim:` and `Evidence:` lines when a result matches a
structured claim. JSON output additionally exposes `matchedClaimId`,
`matchedClaimStatus`, `matchedClaimConfidence`, `evidenceKinds`, and
`evidenceSourceIds` for agent-side drilldown.

### `wiki get <lookup>`

Read a wiki page by id or relative path.

Examples:

```bash
quiet-core-bot wiki get entity.alpha
quiet-core-bot wiki get syntheses/alpha-summary.md --from 1 --lines 80
```

### `wiki apply`

Apply narrow mutations without freeform page surgery.

Supported flows include:

- create/update a synthesis page
- update page metadata
- attach source ids
- add questions
- add contradictions
- update confidence/status
- write structured claims

This command exists so the wiki can evolve safely without manually editing
managed blocks.

### `wiki bridge import`

Import public memory artifacts from the active memory plugin into bridge-backed
source pages.

Use this in `bridge` mode when you want the latest exported memory artifacts
pulled into the wiki vault.

For active bridge artifact reads, the CLI routes the import through Gateway RPC
so the import uses the runtime memory plugin context. If bridge imports are
disabled or artifact reads are turned off, the command keeps the local/offline
zero-import behavior.

### `wiki unsafe-local import`

Import from explicitly configured local paths in `unsafe-local` mode.

This is intentionally experimental and same-machine only.

### `wiki obsidian ...`

Obsidian helper commands for vaults running in Obsidian-friendly mode.

Subcommands:

- `status`
- `search`
- `open`
- `command`
- `daily`

These require the official `obsidian` CLI on `PATH` when
`obsidian.useOfficialCli` is enabled.

## Practical usage guidance

- Use `wiki search` + `wiki get` when provenance and page identity matter.
- Use `wiki apply` instead of hand-editing managed generated sections.
- Use `wiki lint` before trusting contradictory or low-confidence content.
- Use `wiki compile` after bulk imports or source changes when you want fresh
  dashboards and compiled digests immediately.
- Use `wiki okf import` when a data catalog, documentation export, or agent
  enrichment pipeline already emits OKF markdown bundles.
- Use `wiki bridge import` when bridge mode depends on newly exported memory
  artifacts.

## Configuration tie-ins

`quiet-core-bot wiki` behavior is shaped by:

- `plugins.entries.memory-wiki.config.vaultMode`
- `plugins.entries.memory-wiki.config.search.backend`
- `plugins.entries.memory-wiki.config.search.corpus`
- `plugins.entries.memory-wiki.config.bridge.*`
- `plugins.entries.memory-wiki.config.obsidian.*`
- `plugins.entries.memory-wiki.config.render.*`
- `plugins.entries.memory-wiki.config.context.includeCompiledDigestPrompt`

See [Memory Wiki plugin](/plugins/memory-wiki) for the full config model.

## Related

- [CLI reference](/cli)
- [Memory wiki](/plugins/memory-wiki)
