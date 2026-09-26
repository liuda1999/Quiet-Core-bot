import { html, nothing, type TemplateResult } from "lit";
import { t } from "../../i18n/index.ts";
import { icons } from "../icons.ts";
import type { ModelAuthStatusProvider, ModelCatalogEntry } from "../types.ts";

export type ModelsPanelAuthStatus = {
  loading: boolean;
  error: string | null;
  providers: ModelAuthStatusProvider[];
  ts: number;
} | null;

export type ModelsPanelProps = {
  formValue: Record<string, unknown> | null;
  catalog: ModelCatalogEntry[];
  authStatus: ModelsPanelAuthStatus;
  disabled?: boolean;
  probing?: boolean;
  revealedKeys?: Set<string>;
  onPatch: (path: Array<string | number>, value: unknown) => void;
  onRequestUpdate?: () => void;
  onTestConnection?: () => void;
  onToggleReveal?: (providerId: string) => void;
  onRefreshModels?: () => void;
};

type ProviderEntry = {
  id: string;
  baseUrl: string;
  apiKey: string;
  api: string;
  models: Array<Record<string, unknown>>;
};

const API_ADAPTER_OPTIONS = [
  {
    value: "openai-completions",
    labelKey: "settingsLabels.modelsPanel.adapters.openaiCompletions",
  },
  { value: "openai-responses", labelKey: "settingsLabels.modelsPanel.adapters.openaiResponses" },
  {
    value: "anthropic-messages",
    labelKey: "settingsLabels.modelsPanel.adapters.anthropicMessages",
  },
  {
    value: "google-generative-ai",
    labelKey: "settingsLabels.modelsPanel.adapters.googleGenerativeAi",
  },
] as const;

const MASKED_KEY = "••••••••";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function providersRecord(formValue: Record<string, unknown> | null): Record<string, unknown> {
  const models = isRecord(formValue?.models) ? (formValue.models as Record<string, unknown>) : {};
  return isRecord(models.providers) ? { ...(models.providers as Record<string, unknown>) } : {};
}

function readProviders(formValue: Record<string, unknown> | null): ProviderEntry[] {
  const providers = providersRecord(formValue);
  const entries: ProviderEntry[] = [];
  for (const [id, raw] of Object.entries(providers)) {
    const config = isRecord(raw) ? raw : {};
    entries.push({
      id,
      baseUrl: typeof config.baseUrl === "string" ? config.baseUrl : "",
      apiKey: typeof config.apiKey === "string" ? config.apiKey : "",
      api: typeof config.api === "string" ? config.api : "",
      models: Array.isArray(config.models) ? (config.models as Array<Record<string, unknown>>) : [],
    });
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));
  return entries;
}

function adapterLabel(value: string): string {
  const option = API_ADAPTER_OPTIONS.find((entry) => entry.value === value);
  return option ? t(option.labelKey) : value;
}

function modelLabel(model: Record<string, unknown>): string {
  const id = typeof model.id === "string" ? model.id : "";
  const name = typeof model.name === "string" ? model.name : "";
  return name && name !== id ? `${name} (${id})` : id;
}

function providerModelIds(entry: ProviderEntry): string[] {
  return entry.models
    .map((model) => (typeof model.id === "string" ? model.id : ""))
    .filter((id): id is string => Boolean(id));
}

function providerStatusFor(
  id: string,
  authStatus: ModelsPanelAuthStatus,
): { tone: string; label: string } | null {
  const provider = authStatus?.providers?.find((entry) => entry.provider === id);
  if (!provider) {
    return null;
  }
  const tone =
    provider.status === "ok"
      ? "ok"
      : provider.status === "expiring"
        ? "warn"
        : provider.status === "expired" || provider.status === "missing"
          ? "danger"
          : "idle";
  const key = `settingsLabels.modelsPanel.status.${provider.status}`;
  const label = t(key);
  return { tone, label: label === key ? provider.status : label };
}

function uniqueProviderId(record: Record<string, unknown>): string {
  let candidate = "custom-provider";
  let index = 1;
  while (candidate in record) {
    index += 1;
    candidate = `custom-provider-${index}`;
  }
  return candidate;
}

/** Provider ids become config map keys, so keep them URL/CLI safe. */
const PROVIDER_ID_RE = /^[a-z0-9][a-z0-9_-]*$/i;

function providerIdError(id: string): string | null {
  const trimmed = id.trim();
  if (!trimmed || !PROVIDER_ID_RE.test(trimmed)) {
    return t("settingsLabels.modelsPanel.errors.providerIdInvalid");
  }
  return null;
}

function baseUrlError(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return null;
    }
  } catch {
    // Fall through to the shared error below.
  }
  return t("settingsLabels.modelsPanel.errors.baseUrlInvalid");
}

function collectProviderProblems(entries: ProviderEntry[]): string[] {
  const problems: string[] = [];
  for (const entry of entries) {
    const idError = providerIdError(entry.id);
    if (idError) {
      problems.push(idError);
      break;
    }
  }
  for (const entry of entries) {
    const urlError = baseUrlError(entry.baseUrl);
    if (urlError && !problems.includes(urlError)) {
      problems.push(urlError);
    }
  }
  return problems;
}

function buildModelEntry(id: string): Record<string, unknown> {
  return {
    id,
    name: id,
    reasoning: false,
    input: ["text"],
    contextWindow: 128000,
    maxTokens: 4096,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
}

function addProviderModel(
  entry: ProviderEntry,
  props: ModelsPanelProps,
  rawValue: string,
): boolean {
  const value = rawValue.trim();
  if (!value || providerModelIds(entry).includes(value)) {
    return false;
  }
  props.onPatch(
    ["models", "providers", entry.id, "models"],
    [...entry.models, buildModelEntry(value)],
  );
  props.onRequestUpdate?.();
  return true;
}

function renderModelChips(
  entry: ProviderEntry,
  props: ModelsPanelProps,
  disabled: boolean,
): TemplateResult {
  if (entry.models.length === 0) {
    return html`<p class="mp-hint">${t("settingsLabels.modelsPanel.noModels")}</p>`;
  }
  return html`
    <div class="mp-chips">
      ${entry.models.map((model, index) => {
        const label = modelLabel(model);
        return html`
          <span class="mp-chip">
            ${index === 0
              ? html`<span class="mp-chip__tag">${t("settingsLabels.modelsPanel.primary")}</span>`
              : nothing}
            <span class="mp-chip__label" title=${label}>${label}</span>
            <label
              class="mp-chip__reasoning"
              title=${t("settingsLabels.modelsPanel.reasoningHint")}
            >
              <input
                type="checkbox"
                .checked=${model.reasoning === true}
                ?disabled=${disabled}
                @change=${(event: Event) => {
                  const checked = (event.target as HTMLInputElement).checked;
                  const next = entry.models.map((candidate, i) =>
                    i === index ? { ...candidate, reasoning: checked } : candidate,
                  );
                  props.onPatch(["models", "providers", entry.id, "models"], next);
                  props.onRequestUpdate?.();
                }}
              />
              <span>${t("settingsLabels.modelsPanel.reasoning")}</span>
            </label>
            <button
              type="button"
              class="mp-chip__remove"
              title=${t("settingsLabels.modelsPanel.removeModel")}
              ?disabled=${disabled}
              @click=${() => {
                const next = entry.models.filter((_, i) => i !== index);
                props.onPatch(["models", "providers", entry.id, "models"], next);
                props.onRequestUpdate?.();
              }}
            >
              ${icons.x}
            </button>
          </span>
        `;
      })}
    </div>
  `;
}

function renderProviderCard(
  entry: ProviderEntry,
  props: ModelsPanelProps,
  catalog: ModelCatalogEntry[],
): TemplateResult {
  const disabled = Boolean(props.disabled);
  const status = providerStatusFor(entry.id, props.authStatus);
  const isRevealed = props.revealedKeys?.has(entry.id) ?? false;
  const hasStoredKey = entry.apiKey.length > 0;
  const idError = providerIdError(entry.id);
  const urlError = baseUrlError(entry.baseUrl);
  const availableModels = catalog.filter(
    (model) => model.provider === entry.id && !providerModelIds(entry).includes(model.id),
  );

  return html`
    <article class="mp-card">
      <header class="mp-card__head">
        <span class="mp-card__icon">${icons.plug}</span>
        <div class="mp-card__identity">
          <input
            class="mp-input mp-input--title ${idError ? "mp-input--invalid" : ""}"
            .value=${entry.id}
            ?disabled=${disabled}
            spellcheck="false"
            aria-label=${t("settingsLabels.providers.providerId")}
            @change=${(event: Event) => {
              const input = event.target as HTMLInputElement;
              const next = input.value.trim();
              if (!next || next === entry.id) {
                input.value = entry.id;
                return;
              }
              const record = providersRecord(props.formValue);
              if (next in record) {
                input.setCustomValidity(t("settingsLabels.modelsPanel.errors.providerIdDuplicate"));
                if (typeof input.reportValidity === "function") {
                  input.reportValidity();
                }
                input.setCustomValidity("");
                input.value = entry.id;
                return;
              }
              const config = isRecord(record[entry.id])
                ? (record[entry.id] as Record<string, unknown>)
                : {};
              delete record[entry.id];
              record[next] = config;
              props.onPatch(["models", "providers"], record);
              props.onRequestUpdate?.();
            }}
          />
          ${idError ? html`<p class="mp-field__error">${idError}</p>` : nothing}
          <div class="mp-card__meta">
            <span class="mp-badge"
              >${entry.api
                ? adapterLabel(entry.api)
                : t("settingsLabels.providers.noAdapter")}</span
            >
            <span class="mp-badge"
              >${t("settingsLabels.providers.modelCount", {
                count: String(entry.models.length),
              })}</span
            >
            ${status
              ? html`<span class="mp-status mp-status--${status.tone}">${status.label}</span>`
              : nothing}
          </div>
        </div>
        <button
          type="button"
          class="mp-icon-btn mp-icon-btn--danger"
          title=${t("settingsLabels.providers.remove")}
          ?disabled=${disabled}
          @click=${() => {
            const record = providersRecord(props.formValue);
            delete record[entry.id];
            props.onPatch(["models", "providers"], record);
            props.onRequestUpdate?.();
          }}
        >
          ${icons.trash}
        </button>
      </header>

      <div class="mp-card__body">
        <div class="mp-fields">
          <label class="mp-field">
            <span class="mp-field__label">${t("settingsLabels.modelsPanel.baseUrl")}</span>
            <input
              class="mp-input ${urlError ? "mp-input--invalid" : ""}"
              type="url"
              .value=${entry.baseUrl}
              ?disabled=${disabled}
              placeholder=${t("settingsLabels.modelsPanel.baseUrlPlaceholder")}
              spellcheck="false"
              @change=${(event: Event) => {
                const value = (event.target as HTMLInputElement).value.trim();
                props.onPatch(["models", "providers", entry.id, "baseUrl"], value);
                props.onRequestUpdate?.();
              }}
            />
            ${urlError ? html`<p class="mp-field__error">${urlError}</p>` : nothing}
          </label>

          <label class="mp-field">
            <span class="mp-field__label">${t("settingsLabels.modelsPanel.apiKey")}</span>
            <span class="mp-input-group">
              <input
                class="mp-input"
                type=${isRevealed ? "text" : "password"}
                .value=${hasStoredKey && !isRevealed ? MASKED_KEY : entry.apiKey}
                ?disabled=${disabled}
                placeholder=${t("settingsLabels.modelsPanel.apiKeyPlaceholder")}
                spellcheck="false"
                autocomplete="off"
                @change=${(event: Event) => {
                  const value = (event.target as HTMLInputElement).value;
                  if (value === MASKED_KEY) {
                    return;
                  }
                  props.onPatch(["models", "providers", entry.id, "apiKey"], value);
                  props.onRequestUpdate?.();
                }}
              />
              <button
                type="button"
                class="mp-icon-btn"
                title=${isRevealed
                  ? t("settingsLabels.modelsPanel.hideKey")
                  : t("settingsLabels.modelsPanel.showKey")}
                @click=${() => props.onToggleReveal?.(entry.id)}
              >
                ${isRevealed ? icons.eyeOff : icons.eye}
              </button>
            </span>
          </label>

          <label class="mp-field">
            <span class="mp-field__label">${t("settingsLabels.modelsPanel.adapter")}</span>
            <select
              class="mp-input"
              ?disabled=${disabled}
              @change=${(event: Event) => {
                const value = (event.target as HTMLSelectElement).value;
                props.onPatch(["models", "providers", entry.id, "api"], value || undefined);
                props.onRequestUpdate?.();
              }}
            >
              <option value="" ?selected=${!entry.api}>
                ${t("settingsLabels.providers.noAdapter")}
              </option>
              ${API_ADAPTER_OPTIONS.map(
                (option) =>
                  html`<option value=${option.value} ?selected=${entry.api === option.value}>
                    ${t(option.labelKey)}
                  </option>`,
              )}
            </select>
          </label>
        </div>

        <div class="mp-models">
          <span class="mp-field__label">${t("settingsLabels.modelsPanel.models")}</span>
          ${renderModelChips(entry, props, disabled)}
          ${availableModels.length === 0
            ? html`<p class="mp-hint">${t("settingsLabels.modelsPanel.noCatalogModels")}</p>`
            : nothing}
          <div class="mp-add-row">
            <select
              class="mp-input mp-add-row__select"
              ?disabled=${disabled || availableModels.length === 0}
            >
              <option value="">${t("settingsLabels.modelsPanel.addModelPlaceholder")}</option>
              ${availableModels.map(
                (model) => html`<option value=${model.id}>${model.name || model.id}</option>`,
              )}
            </select>
            <button
              type="button"
              class="btn btn--sm"
              ?disabled=${disabled || availableModels.length === 0}
              @click=${(event: Event) => {
                const wrapper = event.currentTarget as HTMLElement;
                const select = wrapper.parentElement?.querySelector(
                  "select",
                ) as HTMLSelectElement | null;
                const value = select?.value ?? "";
                if (addProviderModel(entry, props, value) && select) {
                  select.value = "";
                }
              }}
            >
              ${icons.plus} ${t("settingsLabels.modelsPanel.addModel")}
            </button>
          </div>
          <div class="mp-add-row">
            <input
              class="mp-input mp-add-row__input"
              type="text"
              ?disabled=${disabled}
              placeholder=${t("settingsLabels.modelsPanel.addModelByIdPlaceholder")}
              spellcheck="false"
              @keydown=${(event: KeyboardEvent) => {
                if (event.key !== "Enter") {
                  return;
                }
                event.preventDefault();
                const input = event.currentTarget as HTMLInputElement;
                if (addProviderModel(entry, props, input.value)) {
                  input.value = "";
                }
              }}
            />
            <button
              type="button"
              class="btn btn--sm"
              ?disabled=${disabled}
              @click=${(event: Event) => {
                const wrapper = event.currentTarget as HTMLElement;
                const input = wrapper.parentElement?.querySelector(
                  "input",
                ) as HTMLInputElement | null;
                if (input && addProviderModel(entry, props, input.value)) {
                  input.value = "";
                }
              }}
            >
              ${icons.plus} ${t("settingsLabels.modelsPanel.addModelById")}
            </button>
          </div>
        </div>
      </div>
    </article>
  `;
}

export function renderModelsPanel(props: ModelsPanelProps): TemplateResult {
  const providers = readProviders(props.formValue);
  const catalog = props.catalog ?? [];
  const problems = collectProviderProblems(providers);

  return html`
    <div class="mp-root">
      <div class="mp-head__actions">
        <button
          type="button"
          class="btn btn--sm"
          ?disabled=${props.probing}
          @click=${() => props.onTestConnection?.()}
        >
          ${props.probing ? icons.loader : icons.refresh}
          ${t("settingsLabels.modelsPanel.testConnection")}
        </button>
        <button type="button" class="btn btn--sm" @click=${() => props.onRefreshModels?.()}>
          ${icons.refresh} ${t("common.refresh")}
        </button>
        <button
          type="button"
          class="btn btn--sm primary"
          ?disabled=${Boolean(props.disabled)}
          @click=${() => {
            const record = providersRecord(props.formValue);
            const id = uniqueProviderId(record);
            record[id] = { baseUrl: "", api: "openai-completions", models: [] };
            props.onPatch(["models", "providers"], record);
            props.onRequestUpdate?.();
          }}
        >
          ${icons.plus} ${t("settingsLabels.providers.add")}
        </button>
      </div>

      ${props.authStatus?.error
        ? html`<div class="mp-alert mp-alert--danger">${props.authStatus.error}</div>`
        : nothing}
      ${problems.length > 0
        ? html`<div class="mp-alert mp-alert--warn">
            ${problems.map((problem) => html`<p>${problem}</p>`)}
          </div>`
        : nothing}
      ${providers.length === 0
        ? html`
            <div class="mp-empty-state">
              <span class="mp-empty-state__icon">${icons.plug}</span>
              <p class="mp-empty-state__title">${t("settingsLabels.providers.empty")}</p>
              <p class="mp-empty-state__hint">${t("settingsLabels.modelsPanel.emptyHint")}</p>
            </div>
          `
        : html`
            <div class="mp-grid">
              ${providers.map((entry) => renderProviderCard(entry, props, catalog))}
            </div>
          `}
    </div>
  `;
}
