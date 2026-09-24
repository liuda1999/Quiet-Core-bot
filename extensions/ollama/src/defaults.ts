// Ollama plugin module implements defaults behavior.
export const OLLAMA_DEFAULT_BASE_URL = "http://127.0.0.1:11434";
export const OLLAMA_DOCKER_HOST_BASE_URL = "http://host.docker.internal:11434";
export const OLLAMA_CLOUD_BASE_URL = "https://ollama.com";
export const OLLAMA_GLM52_CLOUD_MODEL_ID = "glm-5.2:cloud";
export const OLLAMA_GLM52_CONTEXT_WINDOW = 1_000_000;

export const OLLAMA_DEFAULT_CONTEXT_WINDOW = 128000;
export const OLLAMA_DEFAULT_MAX_TOKENS = 8192;
/**
 * Context Ollama's server loads a local model with when no `num_ctx` reaches the
 * wire and OLLAMA_CONTEXT_LENGTH is unset: the model's own case is `4096`, and
 * the server then silently truncates the prompt to `num_ctx / 2 + 3` tokens.
 * Measured against ollama 0.34.2 (`/api/ps` -> `context_length=4096`,
 * `prompt_eval_count` pinned at 2051 for prompts of 4.6k-232k tokens); see
 * analysis/s4-raw/s4-ollama-ctx-probe.json.
 */
export const OLLAMA_SERVER_DEFAULT_NUM_CTX = 4096;
export const OLLAMA_ENV_CONTEXT_LENGTH = "OLLAMA_CONTEXT_LENGTH";
export const OLLAMA_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export const OLLAMA_DEFAULT_MODEL = "gemma4";
