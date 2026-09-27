---
summary: "Run Quiet Core bot with Ollama local models"
read_when:
  - You want to run Quiet Core bot with local models via Ollama
  - You need Ollama setup and configuration guidance
  - You want Ollama vision models for image understanding
title: "Ollama"
---

Quiet Core bot integrates with Ollama's native API (`/api/chat`) for local and self-hosted Ollama servers. Setup targets a reachable Ollama host: install Ollama, pull a model, and point the `ollama` provider at your daemon.

```bash
ollama serve
ollama pull gemma4
export OLLAMA_API_KEY="ollama-local"
quiet-core-bot models list --provider ollama
quiet-core-bot models set ollama/gemma4
```

<Warning>
**Remote Ollama users**: Do not use the `/v1` OpenAI-compatible URL (`http://host:11434/v1`) with Quiet Core bot. This breaks tool calling and models may output raw tool JSON as plain text. Use the native Ollama API URL instead: `baseUrl: "http://host:11434"` (no `/v1`).
</Warning>

Ollama provider config uses `baseUrl` as the canonical key. Quiet Core bot also accepts `baseURL` for compatibility with OpenAI SDK-style examples, but new config should prefer `baseUrl`.

## Auth rules

<AccordionGroup>
  <Accordion title="Local and LAN hosts">
    Local and LAN Ollama hosts do not need a real bearer token. Quiet Core bot uses the local `ollama-local` marker only for loopback, private-network, `.local`, and bare-hostname Ollama base URLs.
  </Accordion>
  <Accordion title="Remote and Ollama Cloud hosts">
    Remote public hosts and Ollama Cloud (`https://ollama.com`) require a real credential through `OLLAMA_API_KEY`, an auth profile, or the provider's `apiKey`. Set those endpoints on the `ollama` provider or on a custom provider id with `api: "ollama"`.
  </Accordion>
  <Accordion title="Custom provider ids">
    Custom provider ids that set `api: "ollama"` follow the same rules. For example, an `ollama-remote` provider that points at a private LAN Ollama host can use `apiKey: "ollama-local"` and sub-agents will resolve that marker through the Ollama provider hook instead of treating it as a missing credential. Memory search can also set `agents.defaults.memorySearch.provider` to that custom provider id so embeddings use the matching Ollama endpoint.
  </Accordion>
  <Accordion title="Auth profiles">
    `auth-profiles.json` stores the credential for a provider id. Put endpoint settings (`baseUrl`, `api`, model ids, headers, timeouts) in `models.providers.<id>`. Older flat auth-profile files such as `{ "ollama-windows": { "apiKey": "ollama-local" } }` are not a runtime format; run `quiet-core-bot doctor --fix` to rewrite them to the canonical `ollama-windows:default` API-key profile with a backup. `baseUrl` in that file is compatibility noise and should be moved to provider config.
  </Accordion>
  <Accordion title="Memory embedding scope">
    When Ollama is used for memory embeddings, bearer auth is scoped to the host where it was declared:

    - A provider-level key is sent only to that provider's Ollama host.
    - `agents.*.memorySearch.remote.apiKey` is sent only to its remote embedding host.
    - A pure `OLLAMA_API_KEY` env value is treated as the Ollama Cloud convention, not sent to local or self-hosted hosts by default.

  </Accordion>
</AccordionGroup>

## Getting started

Choose your preferred setup method and mode.

<Tabs>
  <Tab title="Onboarding (recommended)">
    **Best for:** fastest path to a working local Ollama setup.

    <Steps>
      <Step title="Run onboarding">
        ```bash
        quiet-core-bot onboard
        ```

        Select **Ollama** from the provider list.
      </Step>
      <Step title="Point at your Ollama host">
        Onboarding asks for an Ollama base URL, discovers the models installed on that host, and auto-pulls the selected local model if it is not available yet. When Ollama reports an installed `:latest` tag such as `gemma4:latest`, setup shows that installed model once instead of showing both `gemma4` and `gemma4:latest` or pulling the bare alias again.
      </Step>
      <Step title="Verify the model is available">
        ```bash
        quiet-core-bot models list --provider ollama
        ```
      </Step>
    </Steps>

    ### Non-interactive mode

    ```bash
    quiet-core-bot onboard --non-interactive \
      --auth-choice ollama \
      --accept-risk
    ```

    Optionally specify a custom base URL or model:

    ```bash
    quiet-core-bot onboard --non-interactive \
      --auth-choice ollama \
      --custom-base-url "http://ollama-host:11434" \
      --custom-model-id "qwen3.5:27b" \
      --accept-risk
    ```

  </Tab>

  <Tab title="Manual setup">
    **Best for:** full control over the local setup.

    <Steps>
      <Step title="Install Ollama">
        Install Ollama from [ollama.com/download](https://ollama.com/download).

      </Step>
      <Step title="Pull a local model">
        ```bash
        ollama pull gemma4
        # or
        ollama pull gpt-oss:20b
        # or
        ollama pull llama3.3
        ```
      </Step>
      <Step title="Enable Ollama for Quiet Core bot">
        For host-backed setups, any placeholder value works:

        ```bash
        # Local-only
        export OLLAMA_API_KEY="ollama-local"

        # Or configure in your config file
        quiet-core-bot config set models.providers.ollama.apiKey "OLLAMA_API_KEY"
        ```
      </Step>
      <Step title="Inspect and set your model">
        ```bash
        quiet-core-bot models list
        quiet-core-bot models set ollama/gemma4
        ```

        Or set the default in config:

        ```json5
        {
          agents: {
            defaults: {
              model: { primary: "ollama/gemma4" },
            },
          },
        }
        ```
      </Step>
    </Steps>

  </Tab>
</Tabs>

## Local models

Quiet Core bot discovers models from the configured Ollama instance. This path is for local or self-hosted Ollama servers, and Quiet Core bot currently suggests `gemma4` as the local default.

## Model discovery (implicit provider)

When you set `OLLAMA_API_KEY` (or an auth profile) and **do not** define `models.providers.ollama` or another custom remote provider with `api: "ollama"`, Quiet Core bot discovers models from the local Ollama instance at `http://127.0.0.1:11434`.

| Behavior             | Detail                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog query        | Queries `/api/tags`                                                                                                                                                       |
| Capability detection | Uses best-effort `/api/show` lookups to read `contextWindow`, expanded `num_ctx` Modelfile parameters, and capabilities including vision/tools                            |
| Vision models        | Models with a `vision` capability reported by `/api/show` are marked as image-capable (`input: ["text", "image"]`), so Quiet Core bot auto-injects images into the prompt |
| Reasoning detection  | Uses `/api/show` capabilities when available, including `thinking`; falls back to a model-name heuristic (`r1`, `reasoning`, `think`) when Ollama omits capabilities      |
| Token limits         | Sets `maxTokens` to the default Ollama max-token cap used by Quiet Core bot                                                                                               |
| Costs                | Sets all costs to `0`                                                                                                                                                     |

This avoids manual model entries while keeping the catalog aligned with the local Ollama instance. You can use a full ref such as `ollama/<pulled-model>:latest` in local `infer model run`; Quiet Core bot resolves that installed model from Ollama's live catalog without requiring a hand-written `models.json` entry.

For signed-in Ollama hosts, some `:cloud` models may be usable through `/api/chat`
and `/api/show` before they appear in `/api/tags`. When you explicitly select a
full `ollama/<model>:cloud` ref, Quiet Core bot validates that exact missing model with
`/api/show` and adds it to the runtime catalog only if Ollama confirms model
metadata. Typos still fail as unknown models instead of being auto-created.

```bash
# See what models are available
ollama list
quiet-core-bot models list
```

For a narrow text-generation smoke test that avoids the full agent tool surface,
use local `infer model run` with a full Ollama model ref:

```bash
OLLAMA_API_KEY=ollama-local \
  quiet-core-bot infer model run \
    --local \
    --model ollama/llama3.2:latest \
    --prompt "Reply with exactly: pong" \
    --json
```

That path still uses Quiet Core bot's configured provider, auth, and native Ollama
transport, but it does not start a chat-agent turn or load MCP/tool context. If
this succeeds while normal agent replies fail, troubleshoot the model's agent
prompt/tool capacity next.

For a narrow vision-model smoke test on the same lean path, add one or more
image files to `infer model run`. This sends the prompt and image directly to
the selected Ollama vision model without loading chat tools, memory, or prior
session context:

```bash
OLLAMA_API_KEY=ollama-local \
  quiet-core-bot infer model run \
    --local \
    --model ollama/qwen2.5vl:7b \
    --prompt "Describe this image in one sentence." \
    --file ./photo.jpg \
    --json
```

`model run --file` accepts files detected as `image/*`, including common PNG,
JPEG, and WebP inputs. Non-image files are rejected before Ollama is called.
For speech recognition, use `quiet-core-bot infer audio transcribe` instead.

When you switch a conversation with `/model ollama/<model>`, Quiet Core bot treats
that as an exact user selection. If the configured Ollama `baseUrl` is
unreachable, the next reply fails with the provider error instead of silently
answering from another configured fallback model.

Isolated cron jobs do one extra local safety check before they start the agent
turn. If the selected model resolves to a local, private-network, or `.local`
Ollama provider and `/api/tags` is unreachable, Quiet Core bot records that cron run
as `skipped` with the selected `ollama/<model>` in the error text. The endpoint
preflight is cached for 5 minutes, so multiple cron jobs pointed at the same
stopped Ollama daemon do not all launch failing model requests.

Live-verify the local text path, native stream path, and embeddings against
local Ollama with:

```bash
QUIET_CORE_LIVE_TEST=1 QUIET_CORE_LIVE_OLLAMA=1 QUIET_CORE_LIVE_OLLAMA_WEB_SEARCH=0 \
  pnpm test:live -- extensions/ollama/ollama.live.test.ts
```

To add a new model, simply pull it with Ollama:

```bash
ollama pull mistral
```

The new model will be automatically discovered and available to use.

<Note>
If you set `models.providers.ollama` explicitly, or configure a custom remote provider such as `models.providers.ollama-remote` with `api: "ollama"`, auto-discovery is skipped and you must define models manually. Loopback custom providers such as `http://127.0.0.2:11434` are still treated as local. See the explicit config section below.
</Note>

## Vision and image description

The bundled Ollama plugin registers Ollama as an image-capable media-understanding provider. This lets Quiet Core bot route explicit image-description requests and configured image-model defaults through local or hosted Ollama vision models.

For local vision, pull a model that supports images:

```bash
ollama pull qwen2.5vl:7b
export OLLAMA_API_KEY="ollama-local"
```

Then verify with the infer CLI:

```bash
quiet-core-bot infer image describe \
  --file ./photo.jpg \
  --model ollama/qwen2.5vl:7b \
  --json
```

`--model` must be a full `<provider/model>` ref. When it is set, `quiet-core-bot infer image describe` runs that model directly instead of skipping description because the model supports native vision.

Use `infer image describe` when you want Quiet Core bot's image-understanding provider flow, configured `agents.defaults.imageModel`, and image-description output shape. Use `infer model run --file` when you want a raw multimodal model probe with a custom prompt and one or more images.

To make Ollama the default image-understanding model for inbound media, configure `agents.defaults.imageModel`:

```json5
{
  agents: {
    defaults: {
      imageModel: {
        primary: "ollama/qwen2.5vl:7b",
      },
    },
  },
}
```

Prefer the full `ollama/<model>` ref. If the same model is listed under `models.providers.ollama.models` with `input: ["text", "image"]` and no other configured image provider exposes that bare model ID, Quiet Core bot also normalizes a bare `imageModel` ref such as `qwen2.5vl:7b` to `ollama/qwen2.5vl:7b`. If more than one configured image provider has the same bare ID, use the provider prefix explicitly.

Slow local vision models can need a longer image-understanding timeout than cloud models. They can also crash or stop when Ollama tries to allocate the full advertised vision context on constrained hardware. Set a capability timeout, and cap `num_ctx` on the model entry when you only need a normal image-description turn:

```json5
{
  models: {
    providers: {
      ollama: {
        models: [
          {
            id: "qwen2.5vl:7b",
            name: "qwen2.5vl:7b",
            input: ["text", "image"],
            params: { num_ctx: 2048, keep_alive: "1m" },
          },
        ],
      },
    },
  },
  tools: {
    media: {
      image: {
        timeoutSeconds: 180,
        models: [{ provider: "ollama", model: "qwen2.5vl:7b", timeoutSeconds: 300 }],
      },
    },
  },
}
```

This timeout applies to inbound image understanding and to the explicit `image` tool the agent can call during a turn. Provider-level `models.providers.ollama.timeoutSeconds` still controls the underlying Ollama HTTP request guard for normal model calls.

Live-verify the explicit image tool against local Ollama with:

```bash
QUIET_CORE_LIVE_TEST=1 QUIET_CORE_LIVE_OLLAMA_IMAGE=1 \
  pnpm test:live -- src/agents/tools/image-tool.ollama.live.test.ts
```

If you define `models.providers.ollama.models` manually, mark vision models with image input support:

```json5
{
  id: "qwen2.5vl:7b",
  name: "qwen2.5vl:7b",
  input: ["text", "image"],
  contextWindow: 128000,
  maxTokens: 8192,
}
```

Quiet Core bot rejects image-description requests for models that are not marked image-capable. With implicit discovery, Quiet Core bot reads this from Ollama when `/api/show` reports a vision capability.

## Configuration

<Tabs>
  <Tab title="Basic (implicit discovery)">
    The simplest local-only enablement path is via environment variable:

    ```bash
    export OLLAMA_API_KEY="ollama-local"
    ```

    <Tip>
    If `OLLAMA_API_KEY` is set, you can omit `apiKey` in the provider entry and Quiet Core bot will fill it for availability checks.
    </Tip>

  </Tab>

  <Tab title="Explicit (manual models)">
    Use explicit config when Ollama runs on another host/port, you want to force specific context windows or model lists, or you want fully manual model definitions.

    ```json5
    {
      models: {
        providers: {
          ollama: {
            baseUrl: "http://127.0.0.1:11434",
            apiKey: "OLLAMA_API_KEY",
            api: "ollama",
            models: [
              {
                id: "gemma4",
                name: "gemma4",
                reasoning: false,
                input: ["text"],
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                contextWindow: 128000,
                maxTokens: 8192
              }
            ]
          }
        }
      }
    }
    ```

  </Tab>

  <Tab title="Custom base URL">
    If Ollama is running on a different host or port (explicit config disables auto-discovery, so define models manually):

    ```json5
    {
      models: {
        providers: {
          ollama: {
            apiKey: "ollama-local",
            baseUrl: "http://ollama-host:11434", // No /v1 - use native Ollama API URL
            api: "ollama", // Set explicitly to guarantee native tool-calling behavior
            timeoutSeconds: 300, // Optional: give cold local models longer to connect and stream
            models: [
              {
                id: "qwen3:32b",
                name: "qwen3:32b",
                params: {
                  keep_alive: "15m", // Optional: keep the model loaded between turns
                },
              },
            ],
          },
        },
      },
    }
    ```

    <Warning>
    Do not add `/v1` to the URL. The `/v1` path uses OpenAI-compatible mode, where tool calling is not reliable. Use the base Ollama URL without a path suffix.
    </Warning>

  </Tab>
</Tabs>

### Context window and `num_ctx` (native `/api/chat`)

The declared `contextWindow` and the context Ollama actually loads a local model
with are two different numbers. Ollama loads a local model with the Modelfile
`num_ctx` when it has one, and otherwise with its server default
(`OLLAMA_CONTEXT_LENGTH`, 4096 when unset). Declaring the architecture context
from `/api/show` (`*.context_length`) without sending `num_ctx` therefore
over-declares the window, and Ollama silently truncates the prompt.

For the native transport (`api: "ollama"`) the only thing that puts `num_ctx` on
the wire is an explicit model/provider `params.num_ctx`:

```json5
{
  models: {
    providers: {
      ollama: {
        // Applies to every model discovered under this provider.
        params: { num_ctx: 65536 },
        // Keep the declaration aligned with the value above so budgets and
        // compaction decisions match what Ollama really loads.
        contextWindow: 65536,
      },
    },
  },
}
```

Notes:

- Write both keys. Setting `params.num_ctx` without `contextWindow` (or the
  reverse) leaves the declaration and the real window disagreeing; Quiet Core bot warns
  with `[context-window-mismatch]` and the runtime reports the real value from
  `/api/ps` (`context_length`).
- `models.providers.<id>.injectNumCtxForOpenAICompat` (default `true`) only
  affects the **OpenAI-compatible** adapter (`api: "openai-completions"`), used
  when the base URL carries `/v1`. It is not consulted for native `/api/chat`
  requests.
- Model-level `params.num_ctx` wins over the provider-level value.
- Prompt prefill happens on the CPU when there is no supported GPU. A ~25k-token
  agent prompt that includes the provider tool schemas can take minutes to
  prefill, which trips the provider idle timeout; raise
  `models.providers.<id>.timeoutSeconds` for local providers so long prefills
  are not aborted.

## Common recipes

Use these as starting points and replace model IDs with the exact names from `ollama list` or `quiet-core-bot models list --provider ollama`.

<AccordionGroup>
  <Accordion title="Local model with auto-discovery">
    Use this when Ollama runs on the same machine as the Gateway and you want Quiet Core bot to discover the installed models automatically.

    ```bash
    ollama serve
    ollama pull gemma4
    export OLLAMA_API_KEY="ollama-local"
    quiet-core-bot models list --provider ollama
    quiet-core-bot models set ollama/gemma4
    ```

    This path keeps config minimal. Do not add a `models.providers.ollama` block unless you want to define models manually.

  </Accordion>

  <Accordion title="LAN Ollama host with manual models">
    Use native Ollama URLs for LAN hosts. Do not add `/v1`.

    ```json5
    {
      models: {
        providers: {
          ollama: {
            baseUrl: "http://gpu-box.local:11434",
            apiKey: "ollama-local",
            api: "ollama",
            timeoutSeconds: 300,
            contextWindow: 32768,
            maxTokens: 8192,
            models: [
              {
                id: "qwen3.5:9b",
                name: "qwen3.5:9b",
                reasoning: true,
                input: ["text"],
                params: {
                  num_ctx: 32768,
                  thinking: false,
                  keep_alive: "15m",
                },
              },
            ],
          },
        },
      },
      agents: {
        defaults: {
          model: { primary: "ollama/qwen3.5:9b" },
        },
      },
    }
    ```

    `contextWindow` is the Quiet Core bot-side context budget. `params.num_ctx` is sent to Ollama for the request. Keep them aligned when your hardware cannot run the model's full advertised context.

  </Accordion>

  <Accordion title="Multiple Ollama hosts">
    Use custom provider IDs when you have more than one Ollama server. Each provider gets its own host, models, auth, timeout, and model refs.

    ```json5
    {
      models: {
        providers: {
          "ollama-fast": {
            baseUrl: "http://mini.local:11434",
            apiKey: "ollama-local",
            api: "ollama",
            contextWindow: 32768,
            models: [{ id: "gemma4", name: "gemma4", input: ["text"] }],
          },
          "ollama-large": {
            baseUrl: "http://gpu-box.local:11434",
            apiKey: "ollama-local",
            api: "ollama",
            timeoutSeconds: 420,
            contextWindow: 131072,
            maxTokens: 16384,
            models: [{ id: "qwen3.5:27b", name: "qwen3.5:27b", input: ["text"] }],
          },
        },
      },
      agents: {
        defaults: {
          model: {
            primary: "ollama-fast/gemma4",
            fallbacks: ["ollama-large/qwen3.5:27b"],
          },
        },
      },
    }
    ```

    When Quiet Core bot sends the request, the active provider prefix is stripped so `ollama-large/qwen3.5:27b` reaches Ollama as `qwen3.5:27b`.

  </Accordion>

  <Accordion title="Lean local model profile">
    Some local models can answer simple prompts but struggle with the full agent tool surface. Start by limiting tools and context before changing global runtime settings.

    ```json5
    {
      agents: {
        list: [
          {
            id: "local",
            experimental: {
              localModelLean: true,
            },
            model: { primary: "ollama/gemma4" },
          },
        ],
      },
      models: {
        providers: {
          ollama: {
            baseUrl: "http://127.0.0.1:11434",
            apiKey: "ollama-local",
            api: "ollama",
            contextWindow: 32768,
            models: [
              {
                id: "gemma4",
                name: "gemma4",
                input: ["text"],
                params: { num_ctx: 32768 },
                compat: { supportsTools: false },
              },
            ],
          },
        },
      },
    }
    ```

    Use `compat.supportsTools: false` only when the model or server reliably fails on tool schemas. It trades agent capability for stability.
    `localModelLean` removes the browser, cron, and message tools from the direct agent surface and defaults larger catalogs behind structured Tool Search controls except when a run must keep direct message delivery semantics, but it does not change Ollama's runtime context or thinking mode. Pair it with explicit `params.num_ctx` and `params.thinking: false` for small Qwen-style thinking models that loop or spend their response budget on hidden reasoning.

  </Accordion>
</AccordionGroup>

### Model selection

Once configured, all your Ollama models are available:

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "ollama/gpt-oss:20b",
        fallbacks: ["ollama/llama3.3", "ollama/qwen2.5-coder:32b"],
      },
    },
  },
}
```

Custom Ollama provider ids are also supported. When a model ref uses the active
provider prefix, such as `ollama-spark/qwen3:32b`, Quiet Core bot strips only that
prefix before calling Ollama so the server receives `qwen3:32b`.

For slow local models, prefer provider-scoped request tuning before raising the
whole agent runtime timeout:

```json5
{
  models: {
    providers: {
      ollama: {
        timeoutSeconds: 300,
        models: [
          {
            id: "gemma4:26b",
            name: "gemma4:26b",
            params: { keep_alive: "15m" },
          },
        ],
      },
    },
  },
}
```

`timeoutSeconds` applies to the model HTTP request, including connection setup,
headers, body streaming, and the total guarded-fetch abort. `params.keep_alive`
is forwarded to Ollama as top-level `keep_alive` on native `/api/chat` requests;
set it per model when first-turn load time is the bottleneck.

### Quick verification

```bash
# Ollama daemon visible to this machine
curl http://127.0.0.1:11434/api/tags

# Quiet Core bot catalog and selected model
quiet-core-bot models list --provider ollama
quiet-core-bot models status

# Direct model smoke
quiet-core-bot infer model run \
  --model ollama/gemma4 \
  --prompt "Reply with exactly: ok"
```

For remote hosts, replace `127.0.0.1` with the host used in `baseUrl`. If `curl` works but Quiet Core bot does not, check whether the Gateway runs on a different machine, container, or service account.

## Ollama Web Search

Quiet Core bot supports **Ollama Web Search** as a bundled `web_search` provider.

| Property    | Detail                                                                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host        | Uses your configured Ollama host (`models.providers.ollama.baseUrl` when set, otherwise `http://127.0.0.1:11434`); `https://ollama.com` uses the hosted API directly |
| Auth        | Key-free for signed-in local Ollama hosts; `OLLAMA_API_KEY` or configured provider auth for direct `https://ollama.com` search or auth-protected hosts               |
| Requirement | Local/self-hosted hosts must be running and signed in with `ollama signin`; direct hosted search requires `baseUrl: "https://ollama.com"` plus a real Ollama API key |

Choose **Ollama Web Search** during `quiet-core-bot onboard` or `quiet-core-bot configure --section web`, or set:

```json5
{
  tools: {
    web: {
      search: {
        provider: "ollama",
      },
    },
  },
}
```

For direct hosted search through Ollama Cloud:

```json5
{
  models: {
    providers: {
      ollama: {
        baseUrl: "https://ollama.com",
        apiKey: "OLLAMA_API_KEY",
        api: "ollama",
        models: [{ id: "kimi-k2.5:cloud", name: "kimi-k2.5:cloud", input: ["text"] }],
      },
    },
  },
  tools: {
    web: {
      search: { provider: "ollama" },
    },
  },
}
```

For a signed-in local daemon, Quiet Core bot uses the daemon's `/api/experimental/web_search` proxy. For `https://ollama.com`, it calls the hosted `/api/web_search` endpoint directly.

<Note>
For the full setup and behavior details, see [Ollama Web Search](/tools/ollama-search).
</Note>

## Advanced configuration

<AccordionGroup>
  <Accordion title="Legacy OpenAI-compatible mode">
    <Warning>
    **Tool calling is not reliable in OpenAI-compatible mode.** Use this mode only if you need OpenAI format for a proxy and do not depend on native tool calling behavior.
    </Warning>

    If you need to use the OpenAI-compatible endpoint instead (for example, behind a proxy that only supports OpenAI format), set `api: "openai-completions"` explicitly:

    ```json5
    {
      models: {
        providers: {
          ollama: {
            baseUrl: "http://ollama-host:11434/v1",
            api: "openai-completions",
            injectNumCtxForOpenAICompat: true, // default: true
            apiKey: "ollama-local",
            models: [...]
          }
        }
      }
    }
    ```

    This mode may not support streaming and tool calling simultaneously. You may need to disable streaming with `params: { streaming: false }` in model config.

    When `api: "openai-completions"` is used with Ollama, Quiet Core bot injects `options.num_ctx` by default so Ollama does not silently fall back to a 4096 context window. If your proxy/upstream rejects unknown `options` fields, disable this behavior:

    ```json5
    {
      models: {
        providers: {
          ollama: {
            baseUrl: "http://ollama-host:11434/v1",
            api: "openai-completions",
            injectNumCtxForOpenAICompat: false,
            apiKey: "ollama-local",
            models: [...]
          }
        }
      }
    }
    ```

  </Accordion>

  <Accordion title="Context windows">
    For auto-discovered models, Quiet Core bot uses the context window reported by Ollama when available, including larger `PARAMETER num_ctx` values from custom Modelfiles. Otherwise it falls back to the default Ollama context window used by Quiet Core bot.

    You can set provider-level `contextWindow`, `contextTokens`, and `maxTokens` defaults for every model under that Ollama provider, then override them per model when needed. `contextWindow` is Quiet Core bot's prompt and compaction budget. Native Ollama requests leave `options.num_ctx` unset unless you explicitly configure `params.num_ctx`, so Ollama can apply its own model, `OLLAMA_CONTEXT_LENGTH`, or VRAM-based default. To cap or force Ollama's per-request runtime context without rebuilding a Modelfile, set `params.num_ctx`; invalid, zero, negative, and non-finite values are ignored. If you upgraded an older config that used only `contextWindow` or `maxTokens` to force a native Ollama request context, run `quiet-core-bot doctor --fix` to copy those explicit provider or model budgets into `params.num_ctx`. The OpenAI-compatible Ollama adapter still injects `options.num_ctx` by default from the configured `params.num_ctx` or `contextWindow`; disable that with `injectNumCtxForOpenAICompat: false` if your upstream rejects `options`.

    Native Ollama model entries also accept the common Ollama runtime options under `params`, including `temperature`, `top_p`, `top_k`, `min_p`, `num_predict`, `stop`, `repeat_penalty`, `num_batch`, `num_thread`, and `use_mmap`. Quiet Core bot forwards only Ollama request keys, so Quiet Core bot runtime params such as `streaming` are not leaked to Ollama. Use `params.think` or `params.thinking` to send top-level Ollama `think`; `false` disables API-level thinking for Qwen-style thinking models.

    ```json5
    {
      models: {
        providers: {
          ollama: {
            contextWindow: 32768,
            models: [
              {
                id: "llama3.3",
                contextWindow: 131072,
                maxTokens: 65536,
                params: {
                  num_ctx: 32768,
                  temperature: 0.7,
                  top_p: 0.9,
                  thinking: false,
                },
              }
            ]
          }
        }
      }
    }
    ```

    Per-model `agents.defaults.models["ollama/<model>"].params.num_ctx` works too. If both are configured, the explicit provider model entry wins over the agent default.

  </Accordion>

  <Accordion title="Thinking control">
    For native Ollama models, Quiet Core bot forwards thinking control as Ollama expects it: top-level `think`, not `options.think`. Auto-discovered models whose `/api/show` response includes the `thinking` capability expose `/think low`, `/think medium`, `/think high`, and `/think max`; non-thinking models expose only `/think off`.

    ```bash
    quiet-core-bot agent --model ollama/gemma4 --thinking off
    quiet-core-bot agent --model ollama/gemma4 --thinking low
    ```

    You can also set a model default:

    ```json5
    {
      agents: {
        defaults: {
          models: {
            "ollama/gemma4": {
              thinking: "low",
            },
          },
        },
      },
    }
    ```

    Per-model `params.think` or `params.thinking` can disable or force Ollama API thinking for a specific configured model. Quiet Core bot preserves those explicit model params when the active run only has the implicit default `off`; non-off runtime commands such as `/think medium` still override the active run.

  </Accordion>

  <Accordion title="Reasoning models">
    Quiet Core bot treats models with names such as `deepseek-r1`, `reasoning`, or `think` as reasoning-capable by default.

    ```bash
    ollama pull deepseek-r1:32b
    ```

    No additional configuration is needed. Quiet Core bot marks them automatically.

  </Accordion>

  <Accordion title="Model costs">
    Ollama is free and runs locally, so all model costs are set to $0. This applies to both auto-discovered and manually defined models.
  </Accordion>

  <Accordion title="Memory embeddings">
    The bundled Ollama plugin registers a memory embedding provider for
    [memory search](/concepts/memory). It uses the configured Ollama base URL
    and API key, calls Ollama's current `/api/embed` endpoint, and batches
    multiple memory chunks into one `input` request when possible.

    When `proxy.enabled=true`, Ollama memory embedding requests to the exact
    host-local loopback origin derived from the configured `baseUrl` use
    Quiet Core bot's guarded direct path instead of the managed forward proxy. The
    configured hostname must itself be `localhost` or a loopback IP literal;
    DNS names that merely resolve to loopback still use the managed proxy path.
    LAN, tailnet, private-network, and public Ollama hosts also stay on the
    managed proxy path. Redirects to another host or port do not inherit trust.
    Operators can still set the global `proxy.loopbackMode: "proxy"` setting to
    send loopback traffic through the proxy, or `proxy.loopbackMode: "block"`
    to deny loopback connections before opening a connection; see
    [Managed proxy](/security/network-proxy#gateway-loopback-mode) for the
    process-wide effect of this setting.

    | Property      | Value               |
    | ------------- | ------------------- |
    | Default model | `nomic-embed-text`  |
    | Auto-pull     | Yes — the embedding model is pulled automatically if not present locally |

    Query-time embeddings use retrieval prefixes for models that require or recommend them, including `nomic-embed-text`, `qwen3-embedding`, and `mxbai-embed-large`. Memory document batches stay raw so existing indexes do not need a format migration.

    To select Ollama as the memory search embedding provider:

    ```json5
    {
      agents: {
        defaults: {
          memorySearch: {
            provider: "ollama",
            remote: {
              // Default for Ollama. Raise on larger hosts if reindexing is too slow.
              nonBatchConcurrency: 1,
            },
          },
        },
      },
    }
    ```

    For a remote embedding host, keep auth scoped to that host:

    ```json5
    {
      agents: {
        defaults: {
          memorySearch: {
            provider: "ollama",
            model: "nomic-embed-text",
            remote: {
              baseUrl: "http://gpu-box.local:11434",
              apiKey: "ollama-local",
              nonBatchConcurrency: 2,
            },
          },
        },
      },
    }
    ```

  </Accordion>

  <Accordion title="Streaming configuration">
    Quiet Core bot's Ollama integration uses the **native Ollama API** (`/api/chat`) by default, which fully supports streaming and tool calling simultaneously. No special configuration is needed.

    For native `/api/chat` requests, Quiet Core bot also forwards thinking control directly to Ollama: `/think off` and `quiet-core-bot agent --thinking off` send top-level `think: false` unless an explicit model `params.think`/`params.thinking` value is configured, while `/think low|medium|high` send the matching top-level `think` effort string. `/think max` maps to Ollama's highest native effort, `think: "high"`.

    <Tip>
    If you need to use the OpenAI-compatible endpoint, see the "Legacy OpenAI-compatible mode" section above. Streaming and tool calling may not work simultaneously in that mode.
    </Tip>

  </Accordion>
</AccordionGroup>

## Troubleshooting

<AccordionGroup>
  <Accordion title="WSL2 crash loop (repeated reboots)">
    On WSL2 with NVIDIA/CUDA, the official Ollama Linux installer creates an `ollama.service` systemd unit with `Restart=always`. If that service autostarts and loads a GPU-backed model during WSL2 boot, Ollama can pin host memory while the model loads. Hyper-V memory reclaim cannot always reclaim those pinned pages, so Windows can terminate the WSL2 VM, systemd starts Ollama again, and the loop repeats.

    Common evidence:

    - repeated WSL2 reboots or terminations from the Windows side
    - high CPU in `app.slice` or `ollama.service` shortly after WSL2 startup
    - SIGTERM from systemd rather than a Linux OOM-killer event

    Quiet Core bot logs a startup warning when it detects WSL2, `ollama.service` enabled with `Restart=always`, and visible CUDA markers.

    Mitigation:

    ```bash
    sudo systemctl disable ollama
    ```

    Add this to `%USERPROFILE%\.wslconfig` on the Windows side, then run `wsl --shutdown`:

    ```ini
    [experimental]
    autoMemoryReclaim=disabled
    ```

    Set a shorter keep-alive in the Ollama service environment, or start Ollama manually only when you need it:

    ```bash
    export OLLAMA_KEEP_ALIVE=5m
    ollama serve
    ```

    See [ollama/ollama#11317](https://github.com/ollama/ollama/issues/11317).

  </Accordion>

  <Accordion title="Ollama not detected">
    Make sure Ollama is running and that you set `OLLAMA_API_KEY` (or an auth profile), and that you did **not** define an explicit `models.providers.ollama` entry:

    ```bash
    ollama serve
    ```

    Verify that the API is accessible:

    ```bash
    curl http://localhost:11434/api/tags
    ```

  </Accordion>

  <Accordion title="No models available">
    If your model is not listed, either pull the model locally or define it explicitly in `models.providers.ollama`.

    ```bash
    ollama list  # See what's installed
    ollama pull gemma4
    ollama pull gpt-oss:20b
    ollama pull llama3.3     # Or another model
    ```

  </Accordion>

  <Accordion title="Connection refused">
    Check that Ollama is running on the correct port:

    ```bash
    # Check if Ollama is running
    ps aux | grep ollama

    # Or restart Ollama
    ollama serve
    ```

  </Accordion>

  <Accordion title="Remote host works with curl but not Quiet Core bot">
    Verify from the same machine and runtime that runs the Gateway:

    ```bash
    quiet-core-bot gateway status --deep
    curl http://ollama-host:11434/api/tags
    ```

    Common causes:

    - `baseUrl` points at `localhost`, but the Gateway runs in Docker or on another host.
    - The URL uses `/v1`, which selects OpenAI-compatible behavior instead of native Ollama.
    - The remote host needs firewall or LAN binding changes on the Ollama side.
    - The model is present on your laptop's daemon but not on the remote daemon.

  </Accordion>

  <Accordion title="Model outputs tool JSON as text">
    This usually means the provider is using OpenAI-compatible mode or the model cannot handle tool schemas.

    Prefer native Ollama mode:

    ```json5
    {
      models: {
        providers: {
          ollama: {
            baseUrl: "http://ollama-host:11434",
            api: "ollama",
          },
        },
      },
    }
    ```

    If a small local model still fails on tool schemas, set `compat.supportsTools: false` on that model entry and retest.

  </Accordion>

  <Accordion title="Kimi or GLM returns garbled symbols">
    Hosted Kimi/GLM responses that are long, non-linguistic symbol runs are treated as failed provider output instead of a successful assistant answer. That lets normal retry, fallback, or error handling take over without persisting the corrupted text into the session.

    If it happens repeatedly, capture the raw model name and the current session file, then try a fresh session and a fallback model:

    ```bash
    quiet-core-bot infer model run --model ollama/kimi-k2.5:cloud --prompt "Reply with exactly: ok" --json
    quiet-core-bot models set ollama/gemma4
    ```

  </Accordion>

  <Accordion title="Cold local model times out">
    Large local models can need a long first load before streaming begins. Keep the timeout scoped to the Ollama provider, and optionally ask Ollama to keep the model loaded between turns:

    ```json5
    {
      models: {
        providers: {
          ollama: {
            timeoutSeconds: 300,
            models: [
              {
                id: "gemma4:26b",
                name: "gemma4:26b",
                params: { keep_alive: "15m" },
              },
            ],
          },
        },
      },
    }
    ```

    If the host itself is slow to accept connections, `timeoutSeconds` also extends the guarded Undici connect timeout for this provider.

  </Accordion>

  <Accordion title="Large-context model is too slow or runs out of memory">
    Many Ollama models advertise contexts that are larger than your hardware can run comfortably. Native Ollama uses Ollama's own runtime context default unless you set `params.num_ctx`. Cap both Quiet Core bot's budget and Ollama's request context when you want predictable first-token latency:

    ```json5
    {
      models: {
        providers: {
          ollama: {
            contextWindow: 32768,
            maxTokens: 8192,
            models: [
              {
                id: "qwen3.5:9b",
                name: "qwen3.5:9b",
                params: { num_ctx: 32768, thinking: false },
              },
            ],
          },
        },
      },
    }
    ```

    Lower `contextWindow` first if Quiet Core bot is sending too much prompt. Lower `params.num_ctx` if Ollama is loading a runtime context that is too large for the machine. Lower `maxTokens` if generation runs too long.

  </Accordion>
</AccordionGroup>

<Note>
More help: [Troubleshooting](/help/troubleshooting) and [FAQ](/help/faq).
</Note>

## Related

<CardGroup cols={2}>
  <Card title="Model providers" href="/concepts/model-providers" icon="layers">
    Overview of all providers, model refs, and failover behavior.
  </Card>
  <Card title="Model selection" href="/concepts/models" icon="brain">
    How to choose and configure models.
  </Card>
  <Card title="Ollama Web Search" href="/tools/ollama-search" icon="magnifying-glass">
    Full setup and behavior details for Ollama-powered web search.
  </Card>
  <Card title="Configuration" href="/gateway/configuration" icon="gear">
    Full config reference.
  </Card>
</CardGroup>
