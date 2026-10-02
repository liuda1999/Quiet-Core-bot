---
summary: "Generated inventory of QuietCore plugins shipped in core, published externally, or kept source-only"
read_when:
  - You are deciding whether a plugin ships in the core npm package or installs separately
  - You are updating bundled plugin package metadata or release automation
  - You need the canonical internal vs external plugin list
title: "Plugin inventory"
---

# Plugin inventory

This page is generated from `extensions/*/package.json`, `quiet-core-bot.plugin.json`,
and the root npm package `files` exclusions. Regenerate it with:

```bash
pnpm plugins:inventory:gen
```

## Definitions

- **Core npm package:** built into the `quiet-core-bot` npm package and available without a separate plugin install.
- **Official external package:** QuietCore-maintained plugin omitted from the core npm package, kept in this official inventory, and installed on demand through ClawHub and/or npm.
- **Source checkout only:** repo-local plugin omitted from published npm artifacts and not advertised as an installable package.

Source checkouts are different from npm installs: after `pnpm install`, bundled
plugins load from `extensions/<id>` so local edits and package-local workspace
dependencies are available.

## Install a plugin

Use the install route in each entry to decide whether install is needed. Plugins
that say `included in QuietCore` are already present in the core package.
Official external packages need one install, then a Gateway restart.

For example, Discord is an official external package:

```bash
quiet-core-bot plugins install @quiet-core/discord
quiet-core-bot gateway restart
quiet-core-bot plugins inspect discord --runtime --json
```

During the launch cutover, ordinary bare package specs still install from npm.
Use `clawhub:@quiet-core/discord` or `npm:@quiet-core/discord` when you need an
explicit source. After install, follow the plugin's setup doc, such as
[Discord](/channels/discord), to add credentials and channel config. See
[Manage plugins](/plugins/manage-plugins) for update, uninstall, and publishing
commands.

Each entry lists the package, distribution route, and description.

## Core npm package

25 plugins

- **[admin-http-rpc](/plugins/reference/admin-http-rpc)** (`@quiet-core/admin-http-rpc`) - included in QuietCore. QuietCore admin HTTP RPC endpoint.

- **[bonjour](/plugins/reference/bonjour)** (`@quiet-core/bonjour`) - included in QuietCore. Advertise the local QuietCore gateway over Bonjour/mDNS.

- **[browser](/plugins/reference/browser)** (`@quiet-core/browser-plugin`) - included in QuietCore. Adds agent-callable tools.

- **[canvas](/plugins/reference/canvas)** (`@quiet-core/canvas-plugin`) - included in QuietCore. Experimental Canvas control and A2UI rendering surfaces for paired nodes.

- **[comfy](/plugins/reference/comfy)** (`@quiet-core/comfy-provider`) - included in QuietCore. Adds ComfyUI model provider support to QuietCore.

- **[copilot-proxy](/plugins/reference/copilot-proxy)** (`@quiet-core/copilot-proxy`) - included in QuietCore. Adds Copilot Proxy model provider support to QuietCore.

- **[document-extract](/plugins/reference/document-extract)** (`@quiet-core/document-extract-plugin`) - included in QuietCore. Extract text and fallback page images from local document attachments.

- **[file-transfer](/plugins/reference/file-transfer)** (`@quiet-core/file-transfer`) - included in QuietCore. Fetch, list, and write files on paired nodes via dedicated node commands. Bypasses bash stdout truncation by using base64 over node.invoke for binaries up to 16 MB.

- **[litellm](/plugins/reference/litellm)** (`@quiet-core/litellm-provider`) - included in QuietCore. Adds LiteLLM model provider support to QuietCore.

- **[llm-task](/plugins/reference/llm-task)** (`@quiet-core/llm-task`) - included in QuietCore. Generic JSON-only LLM tool for structured tasks callable from workflows.

- **[lmstudio](/plugins/reference/lmstudio)** (`@quiet-core/lmstudio-provider`) - included in QuietCore. Adds LM Studio model provider support to QuietCore.

- **[memory-core](/plugins/reference/memory-core)** (`@quiet-core/memory-core`) - included in QuietCore. Adds agent-callable tools.

- **[memory-wiki](/plugins/reference/memory-wiki)** (`@quiet-core/memory-wiki`) - included in QuietCore. Persistent wiki compiler and Obsidian-friendly knowledge vault for QuietCore.

- **[migrate-claude](/plugins/reference/migrate-claude)** (`@quiet-core/migrate-claude`) - included in QuietCore. Imports Claude Code and Claude Desktop instructions, MCP servers, skills, and safe configuration into QuietCore.

- **[migrate-hermes](/plugins/reference/migrate-hermes)** (`@quiet-core/migrate-hermes`) - included in QuietCore. Imports Hermes configuration, memories, skills, and supported credentials into QuietCore.

- **[oc-path](/plugins/reference/oc-path)** (`@quiet-core/oc-path`) - included in QuietCore. Adds the quiet-core-bot path CLI for oc:// workspace file addressing.

- **[ollama](/plugins/reference/ollama)** (`@quiet-core/ollama-provider`) - included in QuietCore. Adds Ollama model provider support to QuietCore.

- **[open-prose](/plugins/reference/open-prose)** (`@quiet-core/open-prose`) - included in QuietCore. OpenProse VM skill pack with a /prose slash command.

- **[policy](/plugins/reference/policy)** (`@quiet-core/policy`) - included in QuietCore. Adds policy-backed doctor checks for workspace conformance.

- **[sglang](/plugins/reference/sglang)** (`@quiet-core/sglang-provider`) - included in QuietCore. Adds SGLang model provider support to QuietCore.

- **[tts-local-cli](/plugins/reference/tts-local-cli)** (`@quiet-core/tts-local-cli`) - included in QuietCore. Adds text-to-speech provider support.

- **[vllm](/plugins/reference/vllm)** (`@quiet-core/vllm-provider`) - included in QuietCore. Adds vLLM model provider support to QuietCore.

- **[web-readability](/plugins/reference/web-readability)** (`@quiet-core/web-readability-plugin`) - included in QuietCore. Extract readable article content from local HTML web fetch responses.

- **[webhooks](/plugins/reference/webhooks)** (`@quiet-core/webhooks`) - included in QuietCore. Authenticated inbound webhooks that bind external automation to QuietCore TaskFlows.

- **[workboard](/plugins/reference/workboard)** (`@quiet-core/workboard`) - included in QuietCore. Dashboard workboard for agent-owned issues and sessions.

## Official external packages

21 plugins

- **[acpx](/plugins/reference/acpx)** (`@quiet-core/acpx`) - npm; ClawHub. QuietCore ACP runtime backend with plugin-owned session and transport management.

- **[clickclack](/plugins/reference/clickclack)** (`@quiet-core/clickclack`) - npm; ClawHub: `clawhub:@quiet-core/clickclack`. Adds the Clickclack channel surface for sending and receiving QuietCore messages.

- **[diagnostics-otel](/plugins/reference/diagnostics-otel)** (`@quiet-core/diagnostics-otel`) - npm; ClawHub: `clawhub:@quiet-core/diagnostics-otel`. QuietCore diagnostics OpenTelemetry exporter for metrics, traces, and logs.

- **[diagnostics-prometheus](/plugins/reference/diagnostics-prometheus)** (`@quiet-core/diagnostics-prometheus`) - npm; ClawHub: `clawhub:@quiet-core/diagnostics-prometheus`. QuietCore diagnostics Prometheus exporter for runtime metrics.

- **[diffs](/plugins/reference/diffs)** (`@quiet-core/diffs`) - npm; ClawHub. QuietCore read-only diff viewer plugin and file renderer for agents.

- **[diffs-language-pack](/plugins/reference/diffs-language-pack)** (`@quiet-core/diffs-language-pack`) - npm; ClawHub: `clawhub:@quiet-core/diffs-language-pack`. Adds syntax highlighting for languages outside the default diffs viewer set.

- **[firecrawl](/plugins/reference/firecrawl)** (`@quiet-core/firecrawl-plugin`) - npm; ClawHub: `clawhub:@quiet-core/firecrawl-plugin`. Adds agent-callable tools. Adds web fetch provider support. Adds web search provider support.

- **[irc](/plugins/reference/irc)** (`@quiet-core/irc`) - npm; ClawHub: `clawhub:@quiet-core/irc`. Adds the IRC channel surface for sending and receiving QuietCore messages.

- **[llama-cpp](/plugins/reference/llama-cpp)** (`@quiet-core/llama-cpp-provider`) - npm; ClawHub. Local GGUF embeddings through node-llama-cpp.

- **[lobster](/plugins/reference/lobster)** (`@quiet-core/lobster`) - npm; ClawHub. Lobster workflow tool plugin for typed pipelines and resumable approvals.

- **[matrix](/plugins/reference/matrix)** (`@quiet-core/matrix`) - ClawHub: `clawhub:@quiet-core/matrix`; npm. QuietCore Matrix channel plugin for rooms and direct messages.

- **[mattermost](/plugins/reference/mattermost)** (`@quiet-core/mattermost`) - npm; ClawHub: `clawhub:@quiet-core/mattermost`. Adds the Mattermost channel surface for sending and receiving QuietCore messages.

- **[memory-lancedb](/plugins/reference/memory-lancedb)** (`@quiet-core/memory-lancedb`) - npm; ClawHub. QuietCore LanceDB-backed long-term memory plugin with auto-recall, auto-capture, and vector search.

- **[nextcloud-talk](/plugins/reference/nextcloud-talk)** (`@quiet-core/nextcloud-talk`) - npm; ClawHub. QuietCore Nextcloud Talk channel plugin for conversations.

- **[nostr](/plugins/reference/nostr)** (`@quiet-core/nostr`) - npm; ClawHub. QuietCore Nostr channel plugin for NIP-04 encrypted direct messages.

- **[raft](/plugins/reference/raft)** (`@quiet-core/raft`) - npm; ClawHub. QuietCore Raft channel plugin for secure CLI wake bridges.

- **[searxng](/plugins/reference/searxng)** (`@quiet-core/searxng-plugin`) - npm; ClawHub: `clawhub:@quiet-core/searxng-plugin`. Adds web search provider support.

- **[signal](/plugins/reference/signal)** (`@quiet-core/signal`) - npm; ClawHub: `clawhub:@quiet-core/signal`. Adds the Signal channel surface for sending and receiving QuietCore messages.

- **[synology-chat](/plugins/reference/synology-chat)** (`@quiet-core/synology-chat`) - npm; ClawHub. Synology Chat channel plugin for QuietCore channels and direct messages.

- **[tlon](/plugins/reference/tlon)** (`@quiet-core/tlon`) - npm; ClawHub. QuietCore Tlon/Urbit channel plugin for chat workflows.

- **[tokenjuice](/plugins/reference/tokenjuice)** (`@quiet-core/tokenjuice`) - npm; ClawHub: `clawhub:@quiet-core/tokenjuice`. Compacts exec and bash tool results with tokenjuice reducers.

## Source checkout only

3 plugins

- **[qa-channel](/plugins/reference/qa-channel)** (`@quiet-core/qa-channel`) - source checkout only. Adds the QA Channel surface for sending and receiving QuietCore messages.

- **[qa-lab](/plugins/reference/qa-lab)** (`@quiet-core/qa-lab`) - source checkout only. QuietCore QA lab plugin with private debugger UI and scenario runner.

- **[qa-matrix](/plugins/reference/qa-matrix)** (`@quiet-core/qa-matrix`) - source checkout only. Matrix QA transport runner and substrate.
