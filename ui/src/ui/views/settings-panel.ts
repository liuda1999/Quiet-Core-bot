// Control UI renders declarative settings cards for config sections.
import { html, nothing, type TemplateResult } from "lit";
import { t } from "../../i18n/index.ts";
import { icons } from "../icons.ts";
import type { ConfigUiHints } from "../types.ts";
import { hintForPath, humanize } from "./config-form.shared.ts";

export type SettingsFieldKind =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "tags"
  | "secret"
  | "model";

export type SettingsField = {
  path: Array<string | number>;
  kind: SettingsFieldKind;
  options?: readonly string[];
  placeholderKey?: string;
  labelOverride?: string;
  helpOverride?: string;
};

export type SettingsCard = {
  id: string;
  title: string;
  description?: string;
  icon?: TemplateResult;
  fields: SettingsField[];
};

export type SettingsPanelProps = {
  cards: SettingsCard[];
  formValue: Record<string, unknown> | null;
  uiHints: ConfigUiHints;
  disabled?: boolean;
  revealedKeys?: Set<string>;
  onPatch: (path: Array<string | number>, value: unknown) => void;
  onRequestUpdate?: () => void;
  onToggleReveal?: (key: string) => void;
};

const MASKED_SECRET = "••••••••";

/** Walk `formValue` by `path`, returning `undefined` when any segment is missing. */
export function readSettingsValue(
  formValue: Record<string, unknown> | null,
  path: Array<string | number>,
): unknown {
  let current: unknown = formValue;
  for (const segment of path) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[String(segment)];
  }
  return current;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pathAttr(field: SettingsField): string {
  return field.path.join(".");
}

// `t()` returns the key verbatim when a translation is missing, so treat that
// (and an empty string) as "no i18n value" and fall through to the next source.
function translatedOrMissing(key: string): string | null {
  const value = t(key);
  return value && value !== key ? value : null;
}

function fieldLabelKey(field: SettingsField): string {
  return `settingsLabels.panels.fields.${field.path.join(".")}`;
}

function fieldHelpKey(field: SettingsField): string {
  return `settingsLabels.panels.helps.${field.path.join(".")}`;
}

function prettyToken(token: string): string {
  return translatedOrMissing(`settingsLabels.panels.options.${token}`) ?? humanize(token);
}

function labelFor(field: SettingsField, uiHints: ConfigUiHints): string {
  if (field.labelOverride) {
    return field.labelOverride;
  }
  const i18nLabel = translatedOrMissing(fieldLabelKey(field));
  if (i18nLabel) {
    return i18nLabel;
  }
  const hintLabel = hintForPath(field.path, uiHints)?.label;
  if (hintLabel) {
    return hintLabel;
  }
  const last = field.path.at(-1);
  return humanize(last === undefined ? "" : String(last));
}

function helpFor(field: SettingsField, uiHints: ConfigUiHints): string | undefined {
  if (field.helpOverride) {
    return field.helpOverride;
  }
  const i18nHelp = translatedOrMissing(fieldHelpKey(field));
  if (i18nHelp) {
    return i18nHelp;
  }
  return hintForPath(field.path, uiHints)?.help;
}

function numberText(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}

function modelText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (isPlainRecord(value) && typeof value.primary === "string") {
    return value.primary;
  }
  return "";
}

function renderSelect(
  field: SettingsField,
  value: unknown,
  props: SettingsPanelProps,
  disabled: boolean,
  requestUpdate: () => void,
): TemplateResult {
  const current = typeof value === "string" ? value : "";
  const options = field.options ?? [];
  return html`
    <select
      class="mp-input"
      ?disabled=${disabled}
      @change=${(event: Event) => {
        const next = (event.target as HTMLSelectElement).value;
        props.onPatch(field.path, next === "" ? undefined : next);
        requestUpdate();
      }}
    >
      <option value="" ?selected=${current === ""}>${t("settingsLabels.panels.unset")}</option>
      ${options.map(
        (option) => html`
          <option value=${option} ?selected=${current === option}>${prettyToken(option)}</option>
        `,
      )}
    </select>
  `;
}

function renderTags(
  field: SettingsField,
  value: unknown,
  props: SettingsPanelProps,
  disabled: boolean,
  requestUpdate: () => void,
): TemplateResult {
  const items = Array.isArray(value) ? value : [];
  return html`
    <input
      class="mp-input"
      type="text"
      .value=${items.map((item) => String(item)).join(", ")}
      ?disabled=${disabled}
      spellcheck="false"
      @change=${(event: Event) => {
        const next = (event.target as HTMLInputElement).value
          .split(/[,\n]/u)
          .map((part) => part.trim())
          .filter((part) => part.length > 0);
        props.onPatch(field.path, next);
        requestUpdate();
      }}
    />
  `;
}

function renderSecret(
  field: SettingsField,
  value: unknown,
  props: SettingsPanelProps,
  disabled: boolean,
  requestUpdate: () => void,
): TemplateResult {
  const key = pathAttr(field);
  const revealed = props.revealedKeys?.has(key) ?? false;
  const stored = typeof value === "string" ? value : "";
  const masked = stored.length > 0 && !revealed;
  return html`
    <span class="mp-input-group">
      <input
        class="mp-input"
        type=${revealed ? "text" : "password"}
        .value=${masked ? MASKED_SECRET : stored}
        ?disabled=${disabled}
        spellcheck="false"
        autocomplete="off"
        @change=${(event: Event) => {
          const next = (event.target as HTMLInputElement).value;
          if (next === MASKED_SECRET) {
            return;
          }
          props.onPatch(field.path, next);
          requestUpdate();
        }}
      />
      <button
        type="button"
        class="mp-icon-btn"
        title=${revealed
          ? t("settingsLabels.modelsPanel.hideKey")
          : t("settingsLabels.modelsPanel.showKey")}
        ?disabled=${disabled}
        @click=${() => props.onToggleReveal?.(key)}
      >
        ${revealed ? icons.eyeOff : icons.eye}
      </button>
    </span>
  `;
}

function renderControl(
  field: SettingsField,
  value: unknown,
  props: SettingsPanelProps,
  disabled: boolean,
  placeholder: string,
  requestUpdate: () => void,
): TemplateResult {
  switch (field.kind) {
    case "text":
      return html`
        <input
          class="mp-input"
          type="text"
          .value=${typeof value === "string" ? value : ""}
          ?disabled=${disabled}
          placeholder=${placeholder}
          spellcheck="false"
          @change=${(event: Event) => {
            props.onPatch(field.path, (event.target as HTMLInputElement).value.trim());
            requestUpdate();
          }}
        />
      `;
    case "number":
      return html`
        <input
          class="mp-input"
          type="number"
          .value=${numberText(value)}
          ?disabled=${disabled}
          @change=${(event: Event) => {
            const raw = (event.target as HTMLInputElement).value;
            const parsed = Number(raw);
            const next = raw.trim() !== "" && Number.isFinite(parsed) ? parsed : undefined;
            props.onPatch(field.path, next);
            requestUpdate();
          }}
        />
      `;
    case "select":
      return renderSelect(field, value, props, disabled, requestUpdate);
    case "tags":
      return renderTags(field, value, props, disabled, requestUpdate);
    case "secret":
      return renderSecret(field, value, props, disabled, requestUpdate);
    case "model":
      return html`
        <input
          class="mp-input"
          type="text"
          .value=${modelText(value)}
          ?disabled=${disabled}
          placeholder=${placeholder}
          spellcheck="false"
          @change=${(event: Event) => {
            const next = (event.target as HTMLInputElement).value.trim();
            const target = isPlainRecord(value) ? [...field.path, "primary"] : field.path;
            props.onPatch(target, next);
            requestUpdate();
          }}
        />
      `;
    default:
      return html``;
  }
}

function renderField(
  field: SettingsField,
  props: SettingsPanelProps,
  disabled: boolean,
): TemplateResult {
  const value = readSettingsValue(props.formValue, field.path);
  const label = labelFor(field, props.uiHints);
  const help = helpFor(field, props.uiHints);
  const pathKey = pathAttr(field);
  const requestUpdate = () => props.onRequestUpdate?.();
  const placeholder = field.placeholderKey ? t(field.placeholderKey) : "";
  const helpTemplate = help ? html`<span class="mp-field__help">${help}</span>` : nothing;

  if (field.kind === "boolean") {
    return html`
      <label class="sp-check" data-settings-path=${pathKey}>
        <input
          type="checkbox"
          .checked=${value === true}
          ?disabled=${disabled}
          @change=${(event: Event) => {
            props.onPatch(field.path, (event.target as HTMLInputElement).checked);
            requestUpdate();
          }}
        />
        <span class="sp-check__label">${label}</span>
        ${helpTemplate}
      </label>
    `;
  }

  return html`
    <label class="mp-field" data-settings-path=${pathKey}>
      <span class="mp-field__label">${label}</span>
      ${renderControl(field, value, props, disabled, placeholder, requestUpdate)} ${helpTemplate}
    </label>
  `;
}

function renderCard(
  card: SettingsCard,
  props: SettingsPanelProps,
  disabled: boolean,
): TemplateResult {
  return html`
    <article class="mp-card">
      <header class="mp-card__head">
        ${card.icon ? html`<span class="mp-card__icon">${card.icon}</span>` : nothing}
        <div class="mp-card__identity">
          <span class="sp-card__title">${card.title}</span>
          ${card.description ? html`<p class="sp-card__desc">${card.description}</p>` : nothing}
        </div>
      </header>
      <div class="mp-card__body">
        <div class="sp-fields">
          ${card.fields.map((field) => renderField(field, props, disabled))}
        </div>
      </div>
    </article>
  `;
}

export function renderSettingsPanel(props: SettingsPanelProps): TemplateResult {
  const disabled = Boolean(props.disabled);
  return html`
    <div class="sp-root">
      <div class="mp-grid">${props.cards.map((card) => renderCard(card, props, disabled))}</div>
    </div>
  `;
}
