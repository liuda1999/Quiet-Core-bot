---
summary: "Generated inventory of Quiet Core bot plugins shipped in core, published externally, or kept source-only"
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
- **Official external package:** Quiet Core bot-maintained plugin omitted from the core npm package, kept in this official inventory, and installed on demand through ClawHub and/or npm.
- **Source checkout only:** repo-local plugin omitted from published npm artifacts and not advertised as an installable package.

Source checkouts are different from npm installs: after `pnpm install`, bundled
plugins load from `extensions/<id>` so local edits and package-local workspace
dependencies are available.

## Install a plugin

Use the install route in each entry to decide whether install is needed. Plugins
that say `included in Quiet Core bot` are already present in the core package.
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

59 plugins

- **[admin-http-rpc](/plugins/reference/admin-http-rpc)** (`@quiet-core/admin-http-rpc`) - included in Quiet Core bot. Quiet Core bot admin HTTP RPC endpoint.

- **[alibaba](/plugins/reference/alibaba)** (`@quiet-core/alibaba-provider`) - included in Quiet Core bot. Adds video generation provider support.

- **[anthropic](/plugins/reference/anthropic)** (`@quiet-core/anthropic-provider`) - included in Quiet Core bot. Adds Anthropic model provider support to Quiet Core bot.

- **[azure-speech](/plugins/reference/azure-speech)** (`@quiet-core/azure-speech`) - included in Quiet Core bot. Azure AI Speech text-to-speech (MP3, native Ogg/Opus voice notes, PCM telephony).

- **[bonjour](/plugins/reference/bonjour)** (`@quiet-core/bonjour`) - included in Quiet Core bot. Advertise the local Quiet Core bot gateway over Bonjour/mDNS.

- **[browser](/plugins/reference/browser)** (`@quiet-core/browser-plugin`) - included in Quiet Core bot. Adds agent-callable tools.

- **[byteplus](/plugins/reference/byteplus)** (`@quiet-core/byteplus-provider`) - included in Quiet Core bot. Adds BytePlus, BytePlus Plan model provider support to Quiet Core bot.

- **[canvas](/plugins/reference/canvas)** (`@quiet-core/canvas-plugin`) - included in Quiet Core bot. Experimental Canvas control and A2UI rendering surfaces for paired nodes.

- **[codex-supervisor](/plugins/reference/codex-supervisor)** (`@quiet-core/codex-supervisor`) - included in Quiet Core bot. Supervise Codex app-server sessions from Quiet Core bot.

- **[cohere](/plugins/reference/cohere)** (`@quiet-core/cohere-provider`) - included in Quiet Core bot; npm; ClawHub: `clawhub:@quiet-core/cohere-provider`. Quiet Core bot Cohere provider plugin.

- **[comfy](/plugins/reference/comfy)** (`@quiet-core/comfy-provider`) - included in Quiet Core bot. Adds ComfyUI model provider support to Quiet Core bot.

- **[copilot-proxy](/plugins/reference/copilot-proxy)** (`@quiet-core/copilot-proxy`) - included in Quiet Core bot. Adds Copilot Proxy model provider support to Quiet Core bot.

- **[deepgram](/plugins/reference/deepgram)** (`@quiet-core/deepgram-provider`) - included in Quiet Core bot. Adds media understanding provider support. Adds realtime transcription provider support.

- **[document-extract](/plugins/reference/document-extract)** (`@quiet-core/document-extract-plugin`) - included in Quiet Core bot. Extract text and fallback page images from local document attachments.

- **[duckduckgo](/plugins/reference/duckduckgo)** (`@quiet-core/duckduckgo-plugin`) - included in Quiet Core bot. Adds web search provider support.

- **[elevenlabs](/plugins/reference/elevenlabs)** (`@quiet-core/elevenlabs-speech`) - included in Quiet Core bot. Adds media understanding provider support. Adds realtime transcription provider support. Adds text-to-speech provider support.

- **[fal](/plugins/reference/fal)** (`@quiet-core/fal-provider`) - included in Quiet Core bot. Adds fal model provider support to Quiet Core bot.

- **[file-transfer](/plugins/reference/file-transfer)** (`@quiet-core/file-transfer`) - included in Quiet Core bot. Fetch, list, and write files on paired nodes via dedicated node commands. Bypasses bash stdout truncation by using base64 over node.invoke for binaries up to 16 MB.

- **[github-copilot](/plugins/reference/github-copilot)** (`@quiet-core/github-copilot-provider`) - included in Quiet Core bot. Adds GitHub Copilot model provider support to Quiet Core bot.

- **[google](/plugins/reference/google)** (`@quiet-core/google-plugin`) - included in Quiet Core bot. Adds Google, Google Gemini CLI, Google Vertex model provider support to Quiet Core bot.

- **[huggingface](/plugins/reference/huggingface)** (`@quiet-core/huggingface-provider`) - included in Quiet Core bot. Adds Hugging Face model provider support to Quiet Core bot.

- **[imessage](/plugins/reference/imessage)** (`@quiet-core/imessage`) - included in Quiet Core bot. Adds the iMessage channel surface for sending and receiving Quiet Core bot messages.

- **[litellm](/plugins/reference/litellm)** (`@quiet-core/litellm-provider`) - included in Quiet Core bot. Adds LiteLLM model provider support to Quiet Core bot.

- **[llm-task](/plugins/reference/llm-task)** (`@quiet-core/llm-task`) - included in Quiet Core bot. Generic JSON-only LLM tool for structured tasks callable from workflows.

- **[lmstudio](/plugins/reference/lmstudio)** (`@quiet-core/lmstudio-provider`) - included in Quiet Core bot. Adds LM Studio model provider support to Quiet Core bot.

- **[memory-core](/plugins/reference/memory-core)** (`@quiet-core/memory-core`) - included in Quiet Core bot. Adds agent-callable tools.

- **[memory-wiki](/plugins/reference/memory-wiki)** (`@quiet-core/memory-wiki`) - included in Quiet Core bot. Persistent wiki compiler and Obsidian-friendly knowledge vault for Quiet Core bot.

- **[microsoft](/plugins/reference/microsoft)** (`@quiet-core/microsoft-speech`) - included in Quiet Core bot. Adds text-to-speech provider support.

- **[microsoft-foundry](/plugins/reference/microsoft-foundry)** (`@quiet-core/microsoft-foundry`) - included in Quiet Core bot. Adds Microsoft Foundry model provider support to Quiet Core bot.

- **[migrate-claude](/plugins/reference/migrate-claude)** (`@quiet-core/migrate-claude`) - included in Quiet Core bot. Imports Claude Code and Claude Desktop instructions, MCP servers, skills, and safe configuration into Quiet Core bot.

- **[migrate-hermes](/plugins/reference/migrate-hermes)** (`@quiet-core/migrate-hermes`) - included in Quiet Core bot. Imports Hermes configuration, memories, skills, and supported credentials into Quiet Core bot.

- **[minimax](/plugins/reference/minimax)** (`@quiet-core/minimax-provider`) - included in Quiet Core bot. Adds MiniMax, MiniMax Portal model provider support to Quiet Core bot.

- **[mistral](/plugins/reference/mistral)** (`@quiet-core/mistral-provider`) - included in Quiet Core bot. Adds Mistral model provider support to Quiet Core bot.

- **[novita](/plugins/reference/novita)** (`@quiet-core/novita-provider`) - included in Quiet Core bot. Adds Novita, Novita AI, Novitaai model provider support to Quiet Core bot.

- **[nvidia](/plugins/reference/nvidia)** (`@quiet-core/nvidia-provider`) - included in Quiet Core bot. Adds NVIDIA model provider support to Quiet Core bot.

- **[oc-path](/plugins/reference/oc-path)** (`@quiet-core/oc-path`) - included in Quiet Core bot. Adds the quiet-core-bot path CLI for oc:// workspace file addressing.

- **[ollama](/plugins/reference/ollama)** (`@quiet-core/ollama-provider`) - included in Quiet Core bot. Adds Ollama model provider support to Quiet Core bot.

- **[open-prose](/plugins/reference/open-prose)** (`@quiet-core/open-prose`) - included in Quiet Core bot. OpenProse VM skill pack with a /prose slash command.

- **[openai](/plugins/reference/openai)** (`@quiet-core/openai-provider`) - included in Quiet Core bot. Adds OpenAI model provider support to Quiet Core bot.

- **[opencode](/plugins/reference/opencode)** (`@quiet-core/opencode-provider`) - included in Quiet Core bot. Adds OpenCode model provider support to Quiet Core bot.

- **[opencode-go](/plugins/reference/opencode-go)** (`@quiet-core/opencode-go-provider`) - included in Quiet Core bot. Adds OpenCode Go model provider support to Quiet Core bot.

- **[openrouter](/plugins/reference/openrouter)** (`@quiet-core/openrouter-provider`) - included in Quiet Core bot. Adds OpenRouter model provider support to Quiet Core bot.

- **[policy](/plugins/reference/policy)** (`@quiet-core/policy`) - included in Quiet Core bot. Adds policy-backed doctor checks for workspace conformance.

- **[runway](/plugins/reference/runway)** (`@quiet-core/runway-provider`) - included in Quiet Core bot. Adds video generation provider support.

- **[senseaudio](/plugins/reference/senseaudio)** (`@quiet-core/senseaudio-provider`) - included in Quiet Core bot. Adds media understanding provider support.

- **[sglang](/plugins/reference/sglang)** (`@quiet-core/sglang-provider`) - included in Quiet Core bot. Adds SGLang model provider support to Quiet Core bot.

- **[synthetic](/plugins/reference/synthetic)** (`@quiet-core/synthetic-provider`) - included in Quiet Core bot. Adds Synthetic model provider support to Quiet Core bot.

- **[telegram](/plugins/reference/telegram)** (`@quiet-core/telegram`) - included in Quiet Core bot. Adds the Telegram channel surface for sending and receiving Quiet Core bot messages.

- **[together](/plugins/reference/together)** (`@quiet-core/together-provider`) - included in Quiet Core bot. Adds Together model provider support to Quiet Core bot.

- **[tts-local-cli](/plugins/reference/tts-local-cli)** (`@quiet-core/tts-local-cli`) - included in Quiet Core bot. Adds text-to-speech provider support.

- **[vllm](/plugins/reference/vllm)** (`@quiet-core/vllm-provider`) - included in Quiet Core bot. Adds vLLM model provider support to Quiet Core bot.

- **[volcengine](/plugins/reference/volcengine)** (`@quiet-core/volcengine-provider`) - included in Quiet Core bot. Adds Volcengine, Volcengine Plan model provider support to Quiet Core bot.

- **[voyage](/plugins/reference/voyage)** (`@quiet-core/voyage-provider`) - included in Quiet Core bot. Adds memory embedding provider support.

- **[vydra](/plugins/reference/vydra)** (`@quiet-core/vydra-provider`) - included in Quiet Core bot. Adds Vydra model provider support to Quiet Core bot.

- **[web-readability](/plugins/reference/web-readability)** (`@quiet-core/web-readability-plugin`) - included in Quiet Core bot. Extract readable article content from local HTML web fetch responses.

- **[webhooks](/plugins/reference/webhooks)** (`@quiet-core/webhooks`) - included in Quiet Core bot. Authenticated inbound webhooks that bind external automation to Quiet Core bot TaskFlows.

- **[workboard](/plugins/reference/workboard)** (`@quiet-core/workboard`) - included in Quiet Core bot. Dashboard workboard for agent-owned issues and sessions.

- **[xai](/plugins/reference/xai)** (`@quiet-core/xai-plugin`) - included in Quiet Core bot. Adds xAI model provider support to Quiet Core bot.

- **[xiaomi](/plugins/reference/xiaomi)** (`@quiet-core/xiaomi-provider`) - included in Quiet Core bot. Adds Xiaomi, Xiaomi Token Plan model provider support to Quiet Core bot.

## Official external packages

68 plugins

- **[acpx](/plugins/reference/acpx)** (`@quiet-core/acpx`) - npm; ClawHub. Quiet Core bot ACP runtime backend with plugin-owned session and transport management.

- **[amazon-bedrock](/plugins/reference/amazon-bedrock)** (`@quiet-core/amazon-bedrock-provider`) - npm; ClawHub. Quiet Core bot Amazon Bedrock provider plugin with model discovery, embeddings, and guardrail support.

- **[amazon-bedrock-mantle](/plugins/reference/amazon-bedrock-mantle)** (`@quiet-core/amazon-bedrock-mantle-provider`) - npm; ClawHub. Quiet Core bot Amazon Bedrock Mantle provider plugin for OpenAI-compatible model routing.

- **[anthropic-vertex](/plugins/reference/anthropic-vertex)** (`@quiet-core/anthropic-vertex-provider`) - npm; ClawHub. Quiet Core bot Anthropic Vertex provider plugin for Claude models on Google Vertex AI.

- **[arcee](/plugins/reference/arcee)** (`@quiet-core/arcee-provider`) - npm; ClawHub: `clawhub:@quiet-core/arcee-provider`. Adds Arcee model provider support to Quiet Core bot.

- **[brave](/plugins/reference/brave)** (`@quiet-core/brave-plugin`) - npm; ClawHub. Quiet Core bot Brave Search provider plugin for web search.

- **[cerebras](/plugins/reference/cerebras)** (`@quiet-core/cerebras-provider`) - npm; ClawHub: `clawhub:@quiet-core/cerebras-provider`. Adds Cerebras model provider support to Quiet Core bot.

- **[chutes](/plugins/reference/chutes)** (`@quiet-core/chutes-provider`) - npm; ClawHub: `clawhub:@quiet-core/chutes-provider`. Adds Chutes model provider support to Quiet Core bot.

- **[clickclack](/plugins/reference/clickclack)** (`@quiet-core/clickclack`) - npm; ClawHub: `clawhub:@quiet-core/clickclack`. Adds the Clickclack channel surface for sending and receiving Quiet Core bot messages.

- **[cloudflare-ai-gateway](/plugins/reference/cloudflare-ai-gateway)** (`@quiet-core/cloudflare-ai-gateway-provider`) - npm; ClawHub: `clawhub:@quiet-core/cloudflare-ai-gateway-provider`. Adds Cloudflare AI Gateway model provider support to Quiet Core bot.

- **[codex](/plugins/reference/codex)** (`@quiet-core/codex`) - npm; ClawHub. Quiet Core bot Codex app-server harness and model provider plugin with a Codex-managed GPT catalog.

- **[copilot](/plugins/reference/copilot)** (`@quiet-core/copilot`) - npm; ClawHub: `clawhub:@quiet-core/copilot`. Registers the GitHub Copilot agent runtime.

- **[deepinfra](/plugins/reference/deepinfra)** (`@quiet-core/deepinfra-provider`) - npm; ClawHub: `clawhub:@quiet-core/deepinfra-provider`. Adds DeepInfra model provider support to Quiet Core bot.

- **[deepseek](/plugins/reference/deepseek)** (`@quiet-core/deepseek-provider`) - npm; ClawHub: `clawhub:@quiet-core/deepseek-provider`. Adds DeepSeek model provider support to Quiet Core bot.

- **[diagnostics-otel](/plugins/reference/diagnostics-otel)** (`@quiet-core/diagnostics-otel`) - npm; ClawHub: `clawhub:@quiet-core/diagnostics-otel`. Quiet Core bot diagnostics OpenTelemetry exporter for metrics, traces, and logs.

- **[diagnostics-prometheus](/plugins/reference/diagnostics-prometheus)** (`@quiet-core/diagnostics-prometheus`) - npm; ClawHub: `clawhub:@quiet-core/diagnostics-prometheus`. Quiet Core bot diagnostics Prometheus exporter for runtime metrics.

- **[diffs](/plugins/reference/diffs)** (`@quiet-core/diffs`) - npm; ClawHub. Quiet Core bot read-only diff viewer plugin and file renderer for agents.

- **[diffs-language-pack](/plugins/reference/diffs-language-pack)** (`@quiet-core/diffs-language-pack`) - npm; ClawHub: `clawhub:@quiet-core/diffs-language-pack`. Adds syntax highlighting for languages outside the default diffs viewer set.

- **[discord](/plugins/reference/discord)** (`@quiet-core/discord`) - npm; ClawHub. Quiet Core bot Discord channel plugin for channels, DMs, commands, and app events.

- **[exa](/plugins/reference/exa)** (`@quiet-core/exa-plugin`) - npm; ClawHub: `clawhub:@quiet-core/exa-plugin`. Adds web search provider support.

- **[feishu](/plugins/reference/feishu)** (`@quiet-core/feishu`) - npm; ClawHub. Quiet Core bot Feishu/Lark channel plugin for chats and workplace tools (community maintained by @m1heng).

- **[firecrawl](/plugins/reference/firecrawl)** (`@quiet-core/firecrawl-plugin`) - npm; ClawHub: `clawhub:@quiet-core/firecrawl-plugin`. Adds agent-callable tools. Adds web fetch provider support. Adds web search provider support.

- **[fireworks](/plugins/reference/fireworks)** (`@quiet-core/fireworks-provider`) - npm; ClawHub: `clawhub:@quiet-core/fireworks-provider`. Adds Fireworks model provider support to Quiet Core bot.

- **[gmi](/plugins/reference/gmi)** (`@quiet-core/gmi-provider`) - npm; ClawHub: `clawhub:@quiet-core/gmi-provider`. Quiet Core bot GMI Cloud provider plugin.

- **[google-meet](/plugins/reference/google-meet)** (`@quiet-core/google-meet`) - npm; ClawHub. Quiet Core bot Google Meet participant plugin for joining calls through Chrome or Twilio transports.

- **[googlechat](/plugins/reference/googlechat)** (`@quiet-core/googlechat`) - npm; ClawHub. Quiet Core bot Google Chat channel plugin for spaces and direct messages.

- **[gradium](/plugins/reference/gradium)** (`@quiet-core/gradium-speech`) - npm; ClawHub: `clawhub:@quiet-core/gradium-speech`. Adds text-to-speech provider support.

- **[groq](/plugins/reference/groq)** (`@quiet-core/groq-provider`) - npm; ClawHub: `clawhub:@quiet-core/groq-provider`. Adds Groq model provider support to Quiet Core bot.

- **[inworld](/plugins/reference/inworld)** (`@quiet-core/inworld-speech`) - npm; ClawHub: `clawhub:@quiet-core/inworld-speech`. Inworld streaming text-to-speech (MP3, OGG_OPUS, PCM telephony).

- **[irc](/plugins/reference/irc)** (`@quiet-core/irc`) - npm; ClawHub: `clawhub:@quiet-core/irc`. Adds the IRC channel surface for sending and receiving Quiet Core bot messages.

- **[kilocode](/plugins/reference/kilocode)** (`@quiet-core/kilocode-provider`) - npm; ClawHub: `clawhub:@quiet-core/kilocode-provider`. Adds Kilocode model provider support to Quiet Core bot.

- **[kimi](/plugins/reference/kimi)** (`@quiet-core/kimi-provider`) - npm; ClawHub: `clawhub:@quiet-core/kimi-provider`. Adds Kimi, Kimi Coding model provider support to Quiet Core bot.

- **[line](/plugins/reference/line)** (`@quiet-core/line`) - npm; ClawHub. Quiet Core bot LINE channel plugin for LINE Bot API chats.

- **[llama-cpp](/plugins/reference/llama-cpp)** (`@quiet-core/llama-cpp-provider`) - npm; ClawHub. Local GGUF embeddings through node-llama-cpp.

- **[lobster](/plugins/reference/lobster)** (`@quiet-core/lobster`) - npm; ClawHub. Lobster workflow tool plugin for typed pipelines and resumable approvals.

- **[matrix](/plugins/reference/matrix)** (`@quiet-core/matrix`) - ClawHub: `clawhub:@quiet-core/matrix`; npm. Quiet Core bot Matrix channel plugin for rooms and direct messages.

- **[mattermost](/plugins/reference/mattermost)** (`@quiet-core/mattermost`) - npm; ClawHub: `clawhub:@quiet-core/mattermost`. Adds the Mattermost channel surface for sending and receiving Quiet Core bot messages.

- **[memory-lancedb](/plugins/reference/memory-lancedb)** (`@quiet-core/memory-lancedb`) - npm; ClawHub. Quiet Core bot LanceDB-backed long-term memory plugin with auto-recall, auto-capture, and vector search.

- **[moonshot](/plugins/reference/moonshot)** (`@quiet-core/moonshot-provider`) - npm; ClawHub: `clawhub:@quiet-core/moonshot-provider`. Adds Moonshot model provider support to Quiet Core bot.

- **[msteams](/plugins/reference/msteams)** (`@quiet-core/msteams`) - npm; ClawHub. Quiet Core bot Microsoft Teams channel plugin for bot conversations.

- **[nextcloud-talk](/plugins/reference/nextcloud-talk)** (`@quiet-core/nextcloud-talk`) - npm; ClawHub. Quiet Core bot Nextcloud Talk channel plugin for conversations.

- **[nostr](/plugins/reference/nostr)** (`@quiet-core/nostr`) - npm; ClawHub. Quiet Core bot Nostr channel plugin for NIP-04 encrypted direct messages.

- **[openshell](/plugins/reference/openshell)** (`@quiet-core/openshell-sandbox`) - npm; ClawHub. Quiet Core bot sandbox backend for the NVIDIA OpenShell CLI with mirrored local workspaces and SSH command execution.

- **[parallel](/tools/parallel-search)** (`@quiet-core/parallel-plugin`) - npm; ClawHub: `clawhub:@quiet-core/parallel-plugin`. Adds web search provider support.

- **[perplexity](/plugins/reference/perplexity)** (`@quiet-core/perplexity-plugin`) - npm; ClawHub: `clawhub:@quiet-core/perplexity-plugin`. Adds web search provider support.

- **[pixverse](/plugins/reference/pixverse)** (`@quiet-core/pixverse-provider`) - npm; ClawHub: `clawhub:@quiet-core/pixverse-provider`. Quiet Core bot PixVerse video generation provider plugin.

- **[qianfan](/plugins/reference/qianfan)** (`@quiet-core/qianfan-provider`) - npm; ClawHub: `clawhub:@quiet-core/qianfan-provider`. Adds Qianfan model provider support to Quiet Core bot.

- **[qqbot](/plugins/reference/qqbot)** (`@quiet-core/qqbot`) - npm; ClawHub. Quiet Core bot QQ Bot channel plugin for group and direct-message workflows.

- **[qwen](/plugins/reference/qwen)** (`@quiet-core/qwen-provider`) - npm; ClawHub: `clawhub:@quiet-core/qwen-provider`. Adds Qwen, Qwen Cloud, Model Studio, DashScope, Qwen Oauth, Qwen Portal, Qwen CLI model provider support to Quiet Core bot.

- **[raft](/plugins/reference/raft)** (`@quiet-core/raft`) - npm; ClawHub. Quiet Core bot Raft channel plugin for secure CLI wake bridges.

- **[searxng](/plugins/reference/searxng)** (`@quiet-core/searxng-plugin`) - npm; ClawHub: `clawhub:@quiet-core/searxng-plugin`. Adds web search provider support.

- **[signal](/plugins/reference/signal)** (`@quiet-core/signal`) - npm; ClawHub: `clawhub:@quiet-core/signal`. Adds the Signal channel surface for sending and receiving Quiet Core bot messages.

- **[slack](/plugins/reference/slack)** (`@quiet-core/slack`) - npm; ClawHub. Quiet Core bot Slack channel plugin for channels, DMs, commands, and app events.

- **[sms](/plugins/reference/sms)** (`@quiet-core/sms`) - npm; ClawHub: `clawhub:@quiet-core/sms`. Twilio SMS channel plugin for Quiet Core bot text messages.

- **[stepfun](/plugins/reference/stepfun)** (`@quiet-core/stepfun-provider`) - npm; ClawHub: `clawhub:@quiet-core/stepfun-provider`. Adds StepFun, StepFun Plan model provider support to Quiet Core bot.

- **[synology-chat](/plugins/reference/synology-chat)** (`@quiet-core/synology-chat`) - npm; ClawHub. Synology Chat channel plugin for Quiet Core bot channels and direct messages.

- **[tavily](/plugins/reference/tavily)** (`@quiet-core/tavily-plugin`) - npm; ClawHub: `clawhub:@quiet-core/tavily-plugin`. Adds agent-callable tools. Adds web search provider support.

- **[tencent](/plugins/reference/tencent)** (`@quiet-core/tencent-provider`) - npm; ClawHub: `clawhub:@quiet-core/tencent-provider`. Adds Tencent TokenHub model provider support to Quiet Core bot.

- **[tlon](/plugins/reference/tlon)** (`@quiet-core/tlon`) - npm; ClawHub. Quiet Core bot Tlon/Urbit channel plugin for chat workflows.

- **[tokenjuice](/plugins/reference/tokenjuice)** (`@quiet-core/tokenjuice`) - npm; ClawHub: `clawhub:@quiet-core/tokenjuice`. Compacts exec and bash tool results with tokenjuice reducers.

- **[twitch](/plugins/reference/twitch)** (`@quiet-core/twitch`) - npm; ClawHub. Quiet Core bot Twitch channel plugin for chat and moderation workflows.

- **[venice](/plugins/reference/venice)** (`@quiet-core/venice-provider`) - npm; ClawHub: `clawhub:@quiet-core/venice-provider`. Adds Venice model provider support to Quiet Core bot.

- **[vercel-ai-gateway](/plugins/reference/vercel-ai-gateway)** (`@quiet-core/vercel-ai-gateway-provider`) - npm; ClawHub: `clawhub:@quiet-core/vercel-ai-gateway-provider`. Adds Vercel AI Gateway model provider support to Quiet Core bot.

- **[voice-call](/plugins/reference/voice-call)** (`@quiet-core/voice-call`) - npm; ClawHub. Quiet Core bot voice-call plugin for Twilio, Telnyx, and Plivo phone calls.

- **[whatsapp](/plugins/reference/whatsapp)** (`@quiet-core/whatsapp`) - ClawHub: `clawhub:@quiet-core/whatsapp`; npm. Quiet Core bot WhatsApp channel plugin for WhatsApp Web chats.

- **[zai](/plugins/reference/zai)** (`@quiet-core/zai-provider`) - npm; ClawHub: `clawhub:@quiet-core/zai-provider`. Adds Z.AI model provider support to Quiet Core bot.

- **[zalo](/plugins/reference/zalo)** (`@quiet-core/zalo`) - npm; ClawHub. Quiet Core bot Zalo channel plugin for bot and webhook chats.

- **[zalouser](/plugins/reference/zalouser)** (`@quiet-core/zalouser`) - npm; ClawHub. Quiet Core bot Zalo Personal Account plugin via native zca-js integration.

## Source checkout only

3 plugins

- **[qa-channel](/plugins/reference/qa-channel)** (`@quiet-core/qa-channel`) - source checkout only. Adds the QA Channel surface for sending and receiving Quiet Core bot messages.

- **[qa-lab](/plugins/reference/qa-lab)** (`@quiet-core/qa-lab`) - source checkout only. Quiet Core bot QA lab plugin with private debugger UI and scenario runner.

- **[qa-matrix](/plugins/reference/qa-matrix)** (`@quiet-core/qa-matrix`) - source checkout only. Matrix QA transport runner and substrate.
