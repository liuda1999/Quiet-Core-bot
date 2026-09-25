---
summary: "Generated inventory of Quiet Core bot plugins shipped in core, published externally, or kept source-only"
read_when:
  - You are deciding whether a plugin ships in the core npm package or installs separately
  - You are updating bundled plugin package metadata or release automation
  - You need the canonical internal vs external plugin list
title: "Plugin inventory"
---

# Plugin inventory

This page is generated from `extensions/*/package.json`, `openclaw.plugin.json`,
and the root npm package `files` exclusions. Regenerate it with:

```bash
pnpm plugins:inventory:gen
```

## Definitions

- **Core npm package:** built into the `openclaw` npm package and available without a separate plugin install.
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
quiet-core-bot plugins install @openclaw/discord
quiet-core-bot gateway restart
quiet-core-bot plugins inspect discord --runtime --json
```

During the launch cutover, ordinary bare package specs still install from npm.
Use `clawhub:@openclaw/discord` or `npm:@openclaw/discord` when you need an
explicit source. After install, follow the plugin's setup doc, such as
[Discord](/channels/discord), to add credentials and channel config. See
[Manage plugins](/plugins/manage-plugins) for update, uninstall, and publishing
commands.

Each entry lists the package, distribution route, and description.

## Core npm package

59 plugins

- **[admin-http-rpc](/plugins/reference/admin-http-rpc)** (`@openclaw/admin-http-rpc`) - included in Quiet Core bot. Quiet Core bot admin HTTP RPC endpoint.

- **[alibaba](/plugins/reference/alibaba)** (`@openclaw/alibaba-provider`) - included in Quiet Core bot. Adds video generation provider support.

- **[anthropic](/plugins/reference/anthropic)** (`@openclaw/anthropic-provider`) - included in Quiet Core bot. Adds Anthropic model provider support to Quiet Core bot.

- **[azure-speech](/plugins/reference/azure-speech)** (`@openclaw/azure-speech`) - included in Quiet Core bot. Azure AI Speech text-to-speech (MP3, native Ogg/Opus voice notes, PCM telephony).

- **[bonjour](/plugins/reference/bonjour)** (`@openclaw/bonjour`) - included in Quiet Core bot. Advertise the local Quiet Core bot gateway over Bonjour/mDNS.

- **[browser](/plugins/reference/browser)** (`@openclaw/browser-plugin`) - included in Quiet Core bot. Adds agent-callable tools.

- **[byteplus](/plugins/reference/byteplus)** (`@openclaw/byteplus-provider`) - included in Quiet Core bot. Adds BytePlus, BytePlus Plan model provider support to Quiet Core bot.

- **[canvas](/plugins/reference/canvas)** (`@openclaw/canvas-plugin`) - included in Quiet Core bot. Experimental Canvas control and A2UI rendering surfaces for paired nodes.

- **[codex-supervisor](/plugins/reference/codex-supervisor)** (`@openclaw/codex-supervisor`) - included in Quiet Core bot. Supervise Codex app-server sessions from Quiet Core bot.

- **[cohere](/plugins/reference/cohere)** (`@openclaw/cohere-provider`) - included in Quiet Core bot; npm; ClawHub: `clawhub:@openclaw/cohere-provider`. Quiet Core bot Cohere provider plugin.

- **[comfy](/plugins/reference/comfy)** (`@openclaw/comfy-provider`) - included in Quiet Core bot. Adds ComfyUI model provider support to Quiet Core bot.

- **[copilot-proxy](/plugins/reference/copilot-proxy)** (`@openclaw/copilot-proxy`) - included in Quiet Core bot. Adds Copilot Proxy model provider support to Quiet Core bot.

- **[deepgram](/plugins/reference/deepgram)** (`@openclaw/deepgram-provider`) - included in Quiet Core bot. Adds media understanding provider support. Adds realtime transcription provider support.

- **[document-extract](/plugins/reference/document-extract)** (`@openclaw/document-extract-plugin`) - included in Quiet Core bot. Extract text and fallback page images from local document attachments.

- **[duckduckgo](/plugins/reference/duckduckgo)** (`@openclaw/duckduckgo-plugin`) - included in Quiet Core bot. Adds web search provider support.

- **[elevenlabs](/plugins/reference/elevenlabs)** (`@openclaw/elevenlabs-speech`) - included in Quiet Core bot. Adds media understanding provider support. Adds realtime transcription provider support. Adds text-to-speech provider support.

- **[fal](/plugins/reference/fal)** (`@openclaw/fal-provider`) - included in Quiet Core bot. Adds fal model provider support to Quiet Core bot.

- **[file-transfer](/plugins/reference/file-transfer)** (`@openclaw/file-transfer`) - included in Quiet Core bot. Fetch, list, and write files on paired nodes via dedicated node commands. Bypasses bash stdout truncation by using base64 over node.invoke for binaries up to 16 MB.

- **[github-copilot](/plugins/reference/github-copilot)** (`@openclaw/github-copilot-provider`) - included in Quiet Core bot. Adds GitHub Copilot model provider support to Quiet Core bot.

- **[google](/plugins/reference/google)** (`@openclaw/google-plugin`) - included in Quiet Core bot. Adds Google, Google Gemini CLI, Google Vertex model provider support to Quiet Core bot.

- **[huggingface](/plugins/reference/huggingface)** (`@openclaw/huggingface-provider`) - included in Quiet Core bot. Adds Hugging Face model provider support to Quiet Core bot.

- **[imessage](/plugins/reference/imessage)** (`@openclaw/imessage`) - included in Quiet Core bot. Adds the iMessage channel surface for sending and receiving Quiet Core bot messages.

- **[litellm](/plugins/reference/litellm)** (`@openclaw/litellm-provider`) - included in Quiet Core bot. Adds LiteLLM model provider support to Quiet Core bot.

- **[llm-task](/plugins/reference/llm-task)** (`@openclaw/llm-task`) - included in Quiet Core bot. Generic JSON-only LLM tool for structured tasks callable from workflows.

- **[lmstudio](/plugins/reference/lmstudio)** (`@openclaw/lmstudio-provider`) - included in Quiet Core bot. Adds LM Studio model provider support to Quiet Core bot.

- **[memory-core](/plugins/reference/memory-core)** (`@openclaw/memory-core`) - included in Quiet Core bot. Adds agent-callable tools.

- **[memory-wiki](/plugins/reference/memory-wiki)** (`@openclaw/memory-wiki`) - included in Quiet Core bot. Persistent wiki compiler and Obsidian-friendly knowledge vault for Quiet Core bot.

- **[microsoft](/plugins/reference/microsoft)** (`@openclaw/microsoft-speech`) - included in Quiet Core bot. Adds text-to-speech provider support.

- **[microsoft-foundry](/plugins/reference/microsoft-foundry)** (`@openclaw/microsoft-foundry`) - included in Quiet Core bot. Adds Microsoft Foundry model provider support to Quiet Core bot.

- **[migrate-claude](/plugins/reference/migrate-claude)** (`@openclaw/migrate-claude`) - included in Quiet Core bot. Imports Claude Code and Claude Desktop instructions, MCP servers, skills, and safe configuration into Quiet Core bot.

- **[migrate-hermes](/plugins/reference/migrate-hermes)** (`@openclaw/migrate-hermes`) - included in Quiet Core bot. Imports Hermes configuration, memories, skills, and supported credentials into Quiet Core bot.

- **[minimax](/plugins/reference/minimax)** (`@openclaw/minimax-provider`) - included in Quiet Core bot. Adds MiniMax, MiniMax Portal model provider support to Quiet Core bot.

- **[mistral](/plugins/reference/mistral)** (`@openclaw/mistral-provider`) - included in Quiet Core bot. Adds Mistral model provider support to Quiet Core bot.

- **[novita](/plugins/reference/novita)** (`@openclaw/novita-provider`) - included in Quiet Core bot. Adds Novita, Novita AI, Novitaai model provider support to Quiet Core bot.

- **[nvidia](/plugins/reference/nvidia)** (`@openclaw/nvidia-provider`) - included in Quiet Core bot. Adds NVIDIA model provider support to Quiet Core bot.

- **[oc-path](/plugins/reference/oc-path)** (`@openclaw/oc-path`) - included in Quiet Core bot. Adds the openclaw path CLI for oc:// workspace file addressing.

- **[ollama](/plugins/reference/ollama)** (`@openclaw/ollama-provider`) - included in Quiet Core bot. Adds Ollama model provider support to Quiet Core bot.

- **[open-prose](/plugins/reference/open-prose)** (`@openclaw/open-prose`) - included in Quiet Core bot. OpenProse VM skill pack with a /prose slash command.

- **[openai](/plugins/reference/openai)** (`@openclaw/openai-provider`) - included in Quiet Core bot. Adds OpenAI model provider support to Quiet Core bot.

- **[opencode](/plugins/reference/opencode)** (`@openclaw/opencode-provider`) - included in Quiet Core bot. Adds OpenCode model provider support to Quiet Core bot.

- **[opencode-go](/plugins/reference/opencode-go)** (`@openclaw/opencode-go-provider`) - included in Quiet Core bot. Adds OpenCode Go model provider support to Quiet Core bot.

- **[openrouter](/plugins/reference/openrouter)** (`@openclaw/openrouter-provider`) - included in Quiet Core bot. Adds OpenRouter model provider support to Quiet Core bot.

- **[policy](/plugins/reference/policy)** (`@openclaw/policy`) - included in Quiet Core bot. Adds policy-backed doctor checks for workspace conformance.

- **[runway](/plugins/reference/runway)** (`@openclaw/runway-provider`) - included in Quiet Core bot. Adds video generation provider support.

- **[senseaudio](/plugins/reference/senseaudio)** (`@openclaw/senseaudio-provider`) - included in Quiet Core bot. Adds media understanding provider support.

- **[sglang](/plugins/reference/sglang)** (`@openclaw/sglang-provider`) - included in Quiet Core bot. Adds SGLang model provider support to Quiet Core bot.

- **[synthetic](/plugins/reference/synthetic)** (`@openclaw/synthetic-provider`) - included in Quiet Core bot. Adds Synthetic model provider support to Quiet Core bot.

- **[telegram](/plugins/reference/telegram)** (`@openclaw/telegram`) - included in Quiet Core bot. Adds the Telegram channel surface for sending and receiving Quiet Core bot messages.

- **[together](/plugins/reference/together)** (`@openclaw/together-provider`) - included in Quiet Core bot. Adds Together model provider support to Quiet Core bot.

- **[tts-local-cli](/plugins/reference/tts-local-cli)** (`@openclaw/tts-local-cli`) - included in Quiet Core bot. Adds text-to-speech provider support.

- **[vllm](/plugins/reference/vllm)** (`@openclaw/vllm-provider`) - included in Quiet Core bot. Adds vLLM model provider support to Quiet Core bot.

- **[volcengine](/plugins/reference/volcengine)** (`@openclaw/volcengine-provider`) - included in Quiet Core bot. Adds Volcengine, Volcengine Plan model provider support to Quiet Core bot.

- **[voyage](/plugins/reference/voyage)** (`@openclaw/voyage-provider`) - included in Quiet Core bot. Adds memory embedding provider support.

- **[vydra](/plugins/reference/vydra)** (`@openclaw/vydra-provider`) - included in Quiet Core bot. Adds Vydra model provider support to Quiet Core bot.

- **[web-readability](/plugins/reference/web-readability)** (`@openclaw/web-readability-plugin`) - included in Quiet Core bot. Extract readable article content from local HTML web fetch responses.

- **[webhooks](/plugins/reference/webhooks)** (`@openclaw/webhooks`) - included in Quiet Core bot. Authenticated inbound webhooks that bind external automation to Quiet Core bot TaskFlows.

- **[workboard](/plugins/reference/workboard)** (`@openclaw/workboard`) - included in Quiet Core bot. Dashboard workboard for agent-owned issues and sessions.

- **[xai](/plugins/reference/xai)** (`@openclaw/xai-plugin`) - included in Quiet Core bot. Adds xAI model provider support to Quiet Core bot.

- **[xiaomi](/plugins/reference/xiaomi)** (`@openclaw/xiaomi-provider`) - included in Quiet Core bot. Adds Xiaomi, Xiaomi Token Plan model provider support to Quiet Core bot.

## Official external packages

68 plugins

- **[acpx](/plugins/reference/acpx)** (`@openclaw/acpx`) - npm; ClawHub. Quiet Core bot ACP runtime backend with plugin-owned session and transport management.

- **[amazon-bedrock](/plugins/reference/amazon-bedrock)** (`@openclaw/amazon-bedrock-provider`) - npm; ClawHub. Quiet Core bot Amazon Bedrock provider plugin with model discovery, embeddings, and guardrail support.

- **[amazon-bedrock-mantle](/plugins/reference/amazon-bedrock-mantle)** (`@openclaw/amazon-bedrock-mantle-provider`) - npm; ClawHub. Quiet Core bot Amazon Bedrock Mantle provider plugin for OpenAI-compatible model routing.

- **[anthropic-vertex](/plugins/reference/anthropic-vertex)** (`@openclaw/anthropic-vertex-provider`) - npm; ClawHub. Quiet Core bot Anthropic Vertex provider plugin for Claude models on Google Vertex AI.

- **[arcee](/plugins/reference/arcee)** (`@openclaw/arcee-provider`) - npm; ClawHub: `clawhub:@openclaw/arcee-provider`. Adds Arcee model provider support to Quiet Core bot.

- **[brave](/plugins/reference/brave)** (`@openclaw/brave-plugin`) - npm; ClawHub. Quiet Core bot Brave Search provider plugin for web search.

- **[cerebras](/plugins/reference/cerebras)** (`@openclaw/cerebras-provider`) - npm; ClawHub: `clawhub:@openclaw/cerebras-provider`. Adds Cerebras model provider support to Quiet Core bot.

- **[chutes](/plugins/reference/chutes)** (`@openclaw/chutes-provider`) - npm; ClawHub: `clawhub:@openclaw/chutes-provider`. Adds Chutes model provider support to Quiet Core bot.

- **[clickclack](/plugins/reference/clickclack)** (`@openclaw/clickclack`) - npm; ClawHub: `clawhub:@openclaw/clickclack`. Adds the Clickclack channel surface for sending and receiving Quiet Core bot messages.

- **[cloudflare-ai-gateway](/plugins/reference/cloudflare-ai-gateway)** (`@openclaw/cloudflare-ai-gateway-provider`) - npm; ClawHub: `clawhub:@openclaw/cloudflare-ai-gateway-provider`. Adds Cloudflare AI Gateway model provider support to Quiet Core bot.

- **[codex](/plugins/reference/codex)** (`@openclaw/codex`) - npm; ClawHub. Quiet Core bot Codex app-server harness and model provider plugin with a Codex-managed GPT catalog.

- **[copilot](/plugins/reference/copilot)** (`@openclaw/copilot`) - npm; ClawHub: `clawhub:@openclaw/copilot`. Registers the GitHub Copilot agent runtime.

- **[deepinfra](/plugins/reference/deepinfra)** (`@openclaw/deepinfra-provider`) - npm; ClawHub: `clawhub:@openclaw/deepinfra-provider`. Adds DeepInfra model provider support to Quiet Core bot.

- **[deepseek](/plugins/reference/deepseek)** (`@openclaw/deepseek-provider`) - npm; ClawHub: `clawhub:@openclaw/deepseek-provider`. Adds DeepSeek model provider support to Quiet Core bot.

- **[diagnostics-otel](/plugins/reference/diagnostics-otel)** (`@openclaw/diagnostics-otel`) - npm; ClawHub: `clawhub:@openclaw/diagnostics-otel`. Quiet Core bot diagnostics OpenTelemetry exporter for metrics, traces, and logs.

- **[diagnostics-prometheus](/plugins/reference/diagnostics-prometheus)** (`@openclaw/diagnostics-prometheus`) - npm; ClawHub: `clawhub:@openclaw/diagnostics-prometheus`. Quiet Core bot diagnostics Prometheus exporter for runtime metrics.

- **[diffs](/plugins/reference/diffs)** (`@openclaw/diffs`) - npm; ClawHub. Quiet Core bot read-only diff viewer plugin and file renderer for agents.

- **[diffs-language-pack](/plugins/reference/diffs-language-pack)** (`@openclaw/diffs-language-pack`) - npm; ClawHub: `clawhub:@openclaw/diffs-language-pack`. Adds syntax highlighting for languages outside the default diffs viewer set.

- **[discord](/plugins/reference/discord)** (`@openclaw/discord`) - npm; ClawHub. Quiet Core bot Discord channel plugin for channels, DMs, commands, and app events.

- **[exa](/plugins/reference/exa)** (`@openclaw/exa-plugin`) - npm; ClawHub: `clawhub:@openclaw/exa-plugin`. Adds web search provider support.

- **[feishu](/plugins/reference/feishu)** (`@openclaw/feishu`) - npm; ClawHub. Quiet Core bot Feishu/Lark channel plugin for chats and workplace tools (community maintained by @m1heng).

- **[firecrawl](/plugins/reference/firecrawl)** (`@openclaw/firecrawl-plugin`) - npm; ClawHub: `clawhub:@openclaw/firecrawl-plugin`. Adds agent-callable tools. Adds web fetch provider support. Adds web search provider support.

- **[fireworks](/plugins/reference/fireworks)** (`@openclaw/fireworks-provider`) - npm; ClawHub: `clawhub:@openclaw/fireworks-provider`. Adds Fireworks model provider support to Quiet Core bot.

- **[gmi](/plugins/reference/gmi)** (`@openclaw/gmi-provider`) - npm; ClawHub: `clawhub:@openclaw/gmi-provider`. Quiet Core bot GMI Cloud provider plugin.

- **[google-meet](/plugins/reference/google-meet)** (`@openclaw/google-meet`) - npm; ClawHub. Quiet Core bot Google Meet participant plugin for joining calls through Chrome or Twilio transports.

- **[googlechat](/plugins/reference/googlechat)** (`@openclaw/googlechat`) - npm; ClawHub. Quiet Core bot Google Chat channel plugin for spaces and direct messages.

- **[gradium](/plugins/reference/gradium)** (`@openclaw/gradium-speech`) - npm; ClawHub: `clawhub:@openclaw/gradium-speech`. Adds text-to-speech provider support.

- **[groq](/plugins/reference/groq)** (`@openclaw/groq-provider`) - npm; ClawHub: `clawhub:@openclaw/groq-provider`. Adds Groq model provider support to Quiet Core bot.

- **[inworld](/plugins/reference/inworld)** (`@openclaw/inworld-speech`) - npm; ClawHub: `clawhub:@openclaw/inworld-speech`. Inworld streaming text-to-speech (MP3, OGG_OPUS, PCM telephony).

- **[irc](/plugins/reference/irc)** (`@openclaw/irc`) - npm; ClawHub: `clawhub:@openclaw/irc`. Adds the IRC channel surface for sending and receiving Quiet Core bot messages.

- **[kilocode](/plugins/reference/kilocode)** (`@openclaw/kilocode-provider`) - npm; ClawHub: `clawhub:@openclaw/kilocode-provider`. Adds Kilocode model provider support to Quiet Core bot.

- **[kimi](/plugins/reference/kimi)** (`@openclaw/kimi-provider`) - npm; ClawHub: `clawhub:@openclaw/kimi-provider`. Adds Kimi, Kimi Coding model provider support to Quiet Core bot.

- **[line](/plugins/reference/line)** (`@openclaw/line`) - npm; ClawHub. Quiet Core bot LINE channel plugin for LINE Bot API chats.

- **[llama-cpp](/plugins/reference/llama-cpp)** (`@openclaw/llama-cpp-provider`) - npm; ClawHub. Local GGUF embeddings through node-llama-cpp.

- **[lobster](/plugins/reference/lobster)** (`@openclaw/lobster`) - npm; ClawHub. Lobster workflow tool plugin for typed pipelines and resumable approvals.

- **[matrix](/plugins/reference/matrix)** (`@openclaw/matrix`) - ClawHub: `clawhub:@openclaw/matrix`; npm. Quiet Core bot Matrix channel plugin for rooms and direct messages.

- **[mattermost](/plugins/reference/mattermost)** (`@openclaw/mattermost`) - npm; ClawHub: `clawhub:@openclaw/mattermost`. Adds the Mattermost channel surface for sending and receiving Quiet Core bot messages.

- **[memory-lancedb](/plugins/reference/memory-lancedb)** (`@openclaw/memory-lancedb`) - npm; ClawHub. Quiet Core bot LanceDB-backed long-term memory plugin with auto-recall, auto-capture, and vector search.

- **[moonshot](/plugins/reference/moonshot)** (`@openclaw/moonshot-provider`) - npm; ClawHub: `clawhub:@openclaw/moonshot-provider`. Adds Moonshot model provider support to Quiet Core bot.

- **[msteams](/plugins/reference/msteams)** (`@openclaw/msteams`) - npm; ClawHub. Quiet Core bot Microsoft Teams channel plugin for bot conversations.

- **[nextcloud-talk](/plugins/reference/nextcloud-talk)** (`@openclaw/nextcloud-talk`) - npm; ClawHub. Quiet Core bot Nextcloud Talk channel plugin for conversations.

- **[nostr](/plugins/reference/nostr)** (`@openclaw/nostr`) - npm; ClawHub. Quiet Core bot Nostr channel plugin for NIP-04 encrypted direct messages.

- **[openshell](/plugins/reference/openshell)** (`@openclaw/openshell-sandbox`) - npm; ClawHub. Quiet Core bot sandbox backend for the NVIDIA OpenShell CLI with mirrored local workspaces and SSH command execution.

- **[parallel](/tools/parallel-search)** (`@openclaw/parallel-plugin`) - npm; ClawHub: `clawhub:@openclaw/parallel-plugin`. Adds web search provider support.

- **[perplexity](/plugins/reference/perplexity)** (`@openclaw/perplexity-plugin`) - npm; ClawHub: `clawhub:@openclaw/perplexity-plugin`. Adds web search provider support.

- **[pixverse](/plugins/reference/pixverse)** (`@openclaw/pixverse-provider`) - npm; ClawHub: `clawhub:@openclaw/pixverse-provider`. Quiet Core bot PixVerse video generation provider plugin.

- **[qianfan](/plugins/reference/qianfan)** (`@openclaw/qianfan-provider`) - npm; ClawHub: `clawhub:@openclaw/qianfan-provider`. Adds Qianfan model provider support to Quiet Core bot.

- **[qqbot](/plugins/reference/qqbot)** (`@openclaw/qqbot`) - npm; ClawHub. Quiet Core bot QQ Bot channel plugin for group and direct-message workflows.

- **[qwen](/plugins/reference/qwen)** (`@openclaw/qwen-provider`) - npm; ClawHub: `clawhub:@openclaw/qwen-provider`. Adds Qwen, Qwen Cloud, Model Studio, DashScope, Qwen Oauth, Qwen Portal, Qwen CLI model provider support to Quiet Core bot.

- **[raft](/plugins/reference/raft)** (`@openclaw/raft`) - npm; ClawHub. Quiet Core bot Raft channel plugin for secure CLI wake bridges.

- **[searxng](/plugins/reference/searxng)** (`@openclaw/searxng-plugin`) - npm; ClawHub: `clawhub:@openclaw/searxng-plugin`. Adds web search provider support.

- **[signal](/plugins/reference/signal)** (`@openclaw/signal`) - npm; ClawHub: `clawhub:@openclaw/signal`. Adds the Signal channel surface for sending and receiving Quiet Core bot messages.

- **[slack](/plugins/reference/slack)** (`@openclaw/slack`) - npm; ClawHub. Quiet Core bot Slack channel plugin for channels, DMs, commands, and app events.

- **[sms](/plugins/reference/sms)** (`@openclaw/sms`) - npm; ClawHub: `clawhub:@openclaw/sms`. Twilio SMS channel plugin for Quiet Core bot text messages.

- **[stepfun](/plugins/reference/stepfun)** (`@openclaw/stepfun-provider`) - npm; ClawHub: `clawhub:@openclaw/stepfun-provider`. Adds StepFun, StepFun Plan model provider support to Quiet Core bot.

- **[synology-chat](/plugins/reference/synology-chat)** (`@openclaw/synology-chat`) - npm; ClawHub. Synology Chat channel plugin for Quiet Core bot channels and direct messages.

- **[tavily](/plugins/reference/tavily)** (`@openclaw/tavily-plugin`) - npm; ClawHub: `clawhub:@openclaw/tavily-plugin`. Adds agent-callable tools. Adds web search provider support.

- **[tencent](/plugins/reference/tencent)** (`@openclaw/tencent-provider`) - npm; ClawHub: `clawhub:@openclaw/tencent-provider`. Adds Tencent TokenHub model provider support to Quiet Core bot.

- **[tlon](/plugins/reference/tlon)** (`@openclaw/tlon`) - npm; ClawHub. Quiet Core bot Tlon/Urbit channel plugin for chat workflows.

- **[tokenjuice](/plugins/reference/tokenjuice)** (`@openclaw/tokenjuice`) - npm; ClawHub: `clawhub:@openclaw/tokenjuice`. Compacts exec and bash tool results with tokenjuice reducers.

- **[twitch](/plugins/reference/twitch)** (`@openclaw/twitch`) - npm; ClawHub. Quiet Core bot Twitch channel plugin for chat and moderation workflows.

- **[venice](/plugins/reference/venice)** (`@openclaw/venice-provider`) - npm; ClawHub: `clawhub:@openclaw/venice-provider`. Adds Venice model provider support to Quiet Core bot.

- **[vercel-ai-gateway](/plugins/reference/vercel-ai-gateway)** (`@openclaw/vercel-ai-gateway-provider`) - npm; ClawHub: `clawhub:@openclaw/vercel-ai-gateway-provider`. Adds Vercel AI Gateway model provider support to Quiet Core bot.

- **[voice-call](/plugins/reference/voice-call)** (`@openclaw/voice-call`) - npm; ClawHub. Quiet Core bot voice-call plugin for Twilio, Telnyx, and Plivo phone calls.

- **[whatsapp](/plugins/reference/whatsapp)** (`@openclaw/whatsapp`) - ClawHub: `clawhub:@openclaw/whatsapp`; npm. Quiet Core bot WhatsApp channel plugin for WhatsApp Web chats.

- **[zai](/plugins/reference/zai)** (`@openclaw/zai-provider`) - npm; ClawHub: `clawhub:@openclaw/zai-provider`. Adds Z.AI model provider support to Quiet Core bot.

- **[zalo](/plugins/reference/zalo)** (`@openclaw/zalo`) - npm; ClawHub. Quiet Core bot Zalo channel plugin for bot and webhook chats.

- **[zalouser](/plugins/reference/zalouser)** (`@openclaw/zalouser`) - npm; ClawHub. Quiet Core bot Zalo Personal Account plugin via native zca-js integration.

## Source checkout only

3 plugins

- **[qa-channel](/plugins/reference/qa-channel)** (`@openclaw/qa-channel`) - source checkout only. Adds the QA Channel surface for sending and receiving Quiet Core bot messages.

- **[qa-lab](/plugins/reference/qa-lab)** (`@openclaw/qa-lab`) - source checkout only. Quiet Core bot QA lab plugin with private debugger UI and scenario runner.

- **[qa-matrix](/plugins/reference/qa-matrix)** (`@openclaw/qa-matrix`) - source checkout only. Matrix QA transport runner and substrate.
