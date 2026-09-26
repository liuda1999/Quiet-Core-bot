// Control UI view renders logs screen content.
import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { normalizeLowercaseStringOrEmpty } from "../string-coerce.ts";
import type { LogEntry, LogLevel } from "../types.ts";

const LEVELS: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal"];
type ExportFileLabel = "filtered" | "visible";

export type LogsProps = {
  loading: boolean;
  error: string | null;
  file: string | null;
  entries: LogEntry[];
  filterText: string;
  levelFilters: Record<LogLevel, boolean>;
  autoFollow: boolean;
  truncated: boolean;
  onFilterTextChange: (next: string) => void;
  onLevelToggle: (level: LogLevel, enabled: boolean) => void;
  onToggleAutoFollow: (next: boolean) => void;
  onRefresh: () => void;
  onExport: (lines: string[], label: string) => void;
  onScroll: (event: Event) => void;
};

function formatTime(value?: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString();
}

function renderDragonEmblem() {
  return html`
    <svg
      class="dragon-emblem"
      viewBox="0 0 200 160"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="dragonHeadGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ff7a5c" />
          <stop offset="45%" stop-color="#e5243b" />
          <stop offset="100%" stop-color="#8f0f22" />
        </linearGradient>
        <linearGradient id="dragonManeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#c41e30" />
          <stop offset="100%" stop-color="#6d0a18" />
        </linearGradient>
        <linearGradient id="dragonHornGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f6d6a8" />
          <stop offset="100%" stop-color="#c08a4a" />
        </linearGradient>
        <linearGradient id="purpleFlameGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="#3b0a6b" stop-opacity="0.2" />
          <stop offset="40%" stop-color="#8b2fd6" stop-opacity="0.85" />
          <stop offset="75%" stop-color="#c266ff" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#e9c8ff" stop-opacity="0.7" />
        </linearGradient>
        <radialGradient id="purpleAuraGrad" cx="50%" cy="55%" r="55%">
          <stop offset="0%" stop-color="#a855f7" stop-opacity="0.45" />
          <stop offset="70%" stop-color="#6d28d9" stop-opacity="0.12" />
          <stop offset="100%" stop-color="#6d28d9" stop-opacity="0" />
        </radialGradient>
        <filter id="purpleGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse
        class="dragon-emblem__aura"
        cx="100"
        cy="88"
        rx="82"
        ry="62"
        fill="url(#purpleAuraGrad)"
      />

      <g class="dragon-emblem__flames" filter="url(#purpleGlow)">
        <path
          class="dragon-emblem__flame dragon-emblem__flame--1"
          d="M118 118c-10-4-14-14-10-24 3-8 10-12 8-22 8 6 14 14 14 24 0 10-4 18-12 22z"
          fill="url(#purpleFlameGrad)"
        />
        <path
          class="dragon-emblem__flame dragon-emblem__flame--2"
          d="M138 124c-8-6-10-16-5-24 4-7 12-9 12-18 6 8 9 16 7 25-2 8-7 14-14 17z"
          fill="url(#purpleFlameGrad)"
        />
        <path
          class="dragon-emblem__flame dragon-emblem__flame--3"
          d="M100 126c-7-5-9-14-5-21 3-6 9-8 8-16 6 6 10 13 8 21-1 7-5 13-11 16z"
          fill="url(#purpleFlameGrad)"
        />
      </g>

      <g class="dragon-emblem__head">
        <path
          class="dragon-emblem__mane"
          d="M64 42c-14 6-24 20-26 36-2 14 3 28 13 37-9-3-16-10-20-19-6-14-4-31 5-44 6-9 16-15 27-17z"
          fill="url(#dragonManeGrad)"
        />
        <path
          class="dragon-emblem__head-shape"
          d="M74 30c14-6 30-4 42 4 8 5 14 13 18 22 3 7 3 13-1 18-3 4-8 5-13 4-3 5-3 11-1 16 2 6 1 12-3 16-6 6-16 8-26 6l-14-3c-10-2-19-8-24-17-6-11-6-25 0-36 5-11 13-14 22-30z"
          fill="url(#dragonHeadGrad)"
        />
        <path
          class="dragon-emblem__jaw"
          d="M92 96c8 3 17 2 24-3 4-3 6-8 5-13-1-4-5-6-9-5-3 1-5 4-9 5-5 1-10-1-15 1-4 2-5 8-2 11 1 2 4 3 6 4z"
          fill="#7d0d1d"
          opacity="0.85"
        />
        <path
          class="dragon-emblem__horn dragon-emblem__horn--back"
          d="M78 32c-6-10-16-18-28-21 6 12 14 22 25 28z"
          fill="url(#dragonHornGrad)"
        />
        <path
          class="dragon-emblem__horn dragon-emblem__horn--front"
          d="M96 24c-2-11-8-21-17-28 1 13 4 25 11 34z"
          fill="url(#dragonHornGrad)"
        />
        <path
          class="dragon-emblem__brow"
          d="M88 48c6-3 13-3 19 1 2 1 2 4 0 5-6-3-13-3-19-1-2 1-2-4 0-5z"
          fill="#5c0813"
        />
        <path
          class="dragon-emblem__eye"
          d="M92 58c4-4 10-4 14 0 2 2 2 5-1 6-5 2-10 2-14-1-2-2-1-4 1-5z"
          fill="#ffd15c"
        />
        <circle class="dragon-emblem__pupil" cx="99" cy="60" r="2.4" fill="#1a0207" />
        <path
          class="dragon-emblem__nostril"
          d="M126 62c3-1 6 0 8 2 1 1 0 3-2 3-3 0-6-1-8-3 0-1 1-2 2-2z"
          fill="#3d040c"
        />
        <path
          class="dragon-emblem__fang"
          d="M118 88c1 5 2 10 1 15-2-4-4-8-6-12 1-2 3-3 5-3z"
          fill="#f4e3c8"
        />
        <path
          class="dragon-emblem__fang"
          d="M104 92c0 5-1 9-3 13-1-5-1-10 0-14 1-1 2-1 3 1z"
          fill="#f4e3c8"
        />
      </g>

      <g class="dragon-emblem__whiskers">
        <path
          d="M112 70c10-4 20-6 30-5M114 76c10 0 19 2 27 6"
          fill="none"
          stroke="#c41e30"
          stroke-width="2.4"
          stroke-linecap="round"
          opacity="0.8"
        />
      </g>
    </svg>
  `;
}

function matchesFilter(entry: LogEntry, needle: string) {
  if (!needle) {
    return true;
  }
  const haystack = normalizeLowercaseStringOrEmpty(
    [entry.message, entry.subsystem, entry.raw].filter(Boolean).join(" "),
  );
  return haystack.includes(needle);
}

export function renderLogs(props: LogsProps) {
  const needle = normalizeLowercaseStringOrEmpty(props.filterText);
  const levelFiltered = LEVELS.some((level) => !props.levelFilters[level]);
  const filtered = props.entries.filter((entry) => {
    if (entry.level && !props.levelFilters[entry.level]) {
      return false;
    }
    return matchesFilter(entry, needle);
  });
  const exportFileLabel: ExportFileLabel = needle || levelFiltered ? "filtered" : "visible";
  const exportDisplayLabel = t(`logsView.exportLabels.${exportFileLabel}`);

  return html`
    <section class="card card--fill-height">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">${t("logsView.title")}</div>
          <div class="card-sub">${t("logsView.subtitle")}</div>
        </div>
        <div class="row" style="gap: 8px;">
          <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
            ${props.loading ? t("common.loading") : t("common.refresh")}
          </button>
          <button
            class="btn"
            ?disabled=${filtered.length === 0}
            @click=${() =>
              props.onExport(
                filtered.map((entry) => entry.raw),
                exportFileLabel,
              )}
          >
            ${t("logsView.exportButton", { label: exportDisplayLabel })}
          </button>
        </div>
      </div>

      <div class="filters" style="margin-top: 14px;">
        <label class="field" style="min-width: 220px;">
          <span>${t("logsView.filter")}</span>
          <input
            .value=${props.filterText}
            @input=${(e: Event) => props.onFilterTextChange((e.target as HTMLInputElement).value)}
            placeholder=${t("logsView.searchPlaceholder")}
          />
        </label>
        <label class="field checkbox">
          <span>${t("logsView.autoFollow")}</span>
          <input
            type="checkbox"
            .checked=${props.autoFollow}
            @change=${(e: Event) =>
              props.onToggleAutoFollow((e.target as HTMLInputElement).checked)}
          />
        </label>
      </div>

      <div class="chip-row" style="margin-top: 12px;">
        ${LEVELS.map(
          (level) => html`
            <label class="chip log-chip ${level}">
              <input
                type="checkbox"
                .checked=${props.levelFilters[level]}
                @change=${(e: Event) =>
                  props.onLevelToggle(level, (e.target as HTMLInputElement).checked)}
              />
              <span>${level}</span>
            </label>
          `,
        )}
      </div>

      ${props.file
        ? html`
            <div class="muted" style="margin-top: 10px;">
              ${t("logsView.file", { file: props.file })}
            </div>
          `
        : nothing}
      ${props.truncated
        ? html` <div class="callout" style="margin-top: 10px">${t("logsView.truncated")}</div> `
        : nothing}
      ${props.error
        ? html`<div class="callout danger" style="margin-top: 10px;">${props.error}</div>`
        : nothing}

      <div class="log-stream" style="margin-top: 12px;" @scroll=${props.onScroll}>
        ${filtered.length === 0
          ? html`
              <div class="log-empty">
                ${renderDragonEmblem()}
                <div class="log-empty__text">${t("logsView.empty")}</div>
              </div>
            `
          : filtered.map(
              (entry) => html`
                <div class="log-row">
                  <div class="log-time mono">${formatTime(entry.time)}</div>
                  <div class="log-level ${entry.level ?? ""}">${entry.level ?? ""}</div>
                  <div class="log-subsystem mono">${entry.subsystem ?? ""}</div>
                  <div class="log-message mono">${entry.message ?? entry.raw}</div>
                </div>
              `,
            )}
      </div>
    </section>
  `;
}
