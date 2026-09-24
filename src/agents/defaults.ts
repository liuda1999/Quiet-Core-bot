// Defaults for agent metadata when upstream does not supply them.
// Localized baseline: default to the local Ollama runtime and the model
// installed on this machine.
export const DEFAULT_PROVIDER = "ollama";
export const DEFAULT_MODEL = "huihui_ai/gemma-4-abliterated:12b";
// Conservative fallback used when model metadata is unavailable.
export const DEFAULT_CONTEXT_TOKENS = 200_000;
