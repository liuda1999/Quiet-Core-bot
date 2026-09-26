/* @vitest-environment jsdom */

import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import { buildSettingsPanelCards } from "./settings-panel.specs.ts";
import { renderSettingsPanel, type SettingsPanelProps } from "./settings-panel.ts";

function baseProps(overrides?: Partial<SettingsPanelProps>): SettingsPanelProps {
  return {
    cards: buildSettingsPanelCards("tools") ?? [],
    formValue: {},
    uiHints: {},
    disabled: false,
    revealedKeys: new Set<string>(),
    onPatch: vi.fn(),
    onRequestUpdate: vi.fn(),
    onToggleReveal: vi.fn(),
    ...overrides,
  };
}

function renderPanel(props: SettingsPanelProps): HTMLElement {
  const container = document.createElement("div");
  render(renderSettingsPanel(props), container);
  return container;
}

function controlFor(root: Element, path: string): HTMLInputElement | HTMLSelectElement | null {
  return root.querySelector<HTMLInputElement | HTMLSelectElement>(
    `[data-settings-path="${path}"] input, [data-settings-path="${path}"] select`,
  );
}

function fireChange(element: Element): void {
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("settings panel cards", () => {
  it("builds cards for bespoke sections and skips models", () => {
    const tools = buildSettingsPanelCards("tools");
    expect(tools).not.toBeNull();
    expect((tools ?? []).map((card) => card.id)).toEqual([
      "policy",
      "exec",
      "web",
      "fetch",
      "fsMedia",
      "loop",
      "sessions",
    ]);

    expect(buildSettingsPanelCards("agents")).not.toBeNull();
    expect(buildSettingsPanelCards("skills")).not.toBeNull();
    expect(buildSettingsPanelCards("memory")).not.toBeNull();
    expect(buildSettingsPanelCards("session")).not.toBeNull();
    expect(buildSettingsPanelCards("models")).toBeNull();
  });
});

describe("settings panel renderer", () => {
  it("renders one card per spec entry", () => {
    const cards = buildSettingsPanelCards("tools") ?? [];
    const root = renderPanel(baseProps({ cards }));

    expect(root.querySelectorAll(".mp-card").length).toBe(cards.length);
    expect(root.querySelectorAll(".sp-fields").length).toBe(cards.length);
  });

  it("writes text fields with the typed string", () => {
    const props = baseProps();
    const root = renderPanel(props);

    const input = controlFor(root, "tools.web.search.provider");
    expect(input).toBeInstanceOf(HTMLInputElement);
    if (!input) {
      return;
    }
    input.value = "newvalue";
    fireChange(input);

    expect(props.onPatch).toHaveBeenCalledWith(["tools", "web", "search", "provider"], "newvalue");
  });

  it("writes boolean fields with the checkbox state", () => {
    const props = baseProps();
    const root = renderPanel(props);

    const input = controlFor(root, "tools.web.search.enabled");
    expect(input).toBeInstanceOf(HTMLInputElement);
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    input.checked = true;
    fireChange(input);

    expect(props.onPatch).toHaveBeenCalledWith(["tools", "web", "search", "enabled"], true);
  });

  it("writes select fields with the chosen enum value", () => {
    const props = baseProps();
    const root = renderPanel(props);

    const select = root.querySelector<HTMLSelectElement>(
      '[data-settings-path="tools.profile"] select',
    );
    expect(select).toBeInstanceOf(HTMLSelectElement);
    if (!select) {
      return;
    }
    select.value = "coding";
    fireChange(select);

    expect(props.onPatch).toHaveBeenCalledWith(["tools", "profile"], "coding");
  });

  it("writes tags fields as a trimmed string array", () => {
    const props = baseProps();
    const root = renderPanel(props);

    const input = controlFor(root, "tools.allow");
    expect(input).toBeInstanceOf(HTMLInputElement);
    if (!input) {
      return;
    }
    input.value = "alpha, beta, gamma , ,";
    fireChange(input);

    expect(props.onPatch).toHaveBeenCalledWith(["tools", "allow"], ["alpha", "beta", "gamma"]);
  });

  it("reads nested values into the rendered controls", () => {
    const root = renderPanel(
      baseProps({
        formValue: { tools: { profile: "full", web: { search: { provider: "brave" } } } },
      }),
    );

    const select = root.querySelector<HTMLSelectElement>(
      '[data-settings-path="tools.profile"] select',
    );
    expect(select?.value).toBe("full");

    const input = controlFor(root, "tools.web.search.provider");
    expect((input as HTMLInputElement | null)?.value).toBe("brave");
  });
});
