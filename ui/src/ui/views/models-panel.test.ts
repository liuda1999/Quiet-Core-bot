/* @vitest-environment jsdom */

import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import { renderModelsPanel, type ModelsPanelProps } from "./models-panel.ts";

function baseProps(overrides?: Partial<ModelsPanelProps>): ModelsPanelProps {
  return {
    formValue: { models: { providers: {} } },
    catalog: [],
    authStatus: null,
    disabled: false,
    probing: false,
    revealedKeys: new Set<string>(),
    onPatch: vi.fn(),
    onRequestUpdate: vi.fn(),
    onTestConnection: vi.fn(),
    onToggleReveal: vi.fn(),
    onRefreshModels: vi.fn(),
    ...overrides,
  };
}

function renderPanel(props: ModelsPanelProps): HTMLElement {
  const container = document.createElement("div");
  render(renderModelsPanel(props), container);
  return container;
}

function buttonByText(root: Element, text: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  expect(button).toBeInstanceOf(HTMLButtonElement);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected a button labelled "${text}"`);
  }
  return button;
}

describe("models panel", () => {
  it("adds a provider with a valid default id", () => {
    const props = baseProps();
    const root = renderPanel(props);

    buttonByText(root, "Add provider").click();

    expect(props.onPatch).toHaveBeenCalledTimes(1);
    const [path, value] = (props.onPatch as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0] as [Array<string>, Record<string, unknown>];
    expect(path).toEqual(["models", "providers"]);
    expect(Object.keys(value)).toEqual(["custom-provider"]);
    expect(value["custom-provider"]).toMatchObject({ api: "openai-completions" });
  });

  it("flags an invalid base URL", () => {
    const props = baseProps({
      formValue: { models: { providers: { broken: { baseUrl: "not a url" } } } },
    });
    const root = renderPanel(props);

    expect(root.querySelector(".mp-field__error")?.textContent ?? "").toContain("http");
    expect(root.querySelector(".mp-alert--warn")).not.toBeNull();
  });

  it("rejects renaming a provider onto an existing id", () => {
    const props = baseProps({
      formValue: {
        models: {
          providers: {
            alpha: { baseUrl: "" },
            beta: { baseUrl: "" },
          },
        },
      },
    });
    const root = renderPanel(props);

    const inputs = root.querySelectorAll<HTMLInputElement>(".mp-input--title");
    const alpha = inputs[0];
    alpha.value = "beta";
    alpha.dispatchEvent(new Event("change", { bubbles: true }));

    expect(props.onPatch).not.toHaveBeenCalled();
    expect(alpha.value).toBe("alpha");
  });

  it("exposes a manual refresh for the model catalog", () => {
    const props = baseProps();
    const root = renderPanel(props);

    buttonByText(root, "Refresh").click();
    expect(props.onRefreshModels).toHaveBeenCalledTimes(1);
  });

  it("hints at manual model entry when the catalog has no models for the provider", () => {
    const props = baseProps({
      formValue: {
        models: {
          providers: {
            deepseek: { baseUrl: "https://api.deepseek.com", models: [] },
          },
        },
      },
    });
    const root = renderPanel(props);

    const hints = Array.from(root.querySelectorAll(".mp-hint")).map(
      (element) => element.textContent ?? "",
    );
    expect(hints.some((text) => text.includes("model ID"))).toBe(true);
  });

  it("adds a custom model id so new providers can be used in chat", () => {
    const props = baseProps({
      formValue: {
        models: {
          providers: {
            deepseek: {
              baseUrl: "https://api.deepseek.com",
              api: "openai-completions",
              models: [],
            },
          },
        },
      },
    });
    const root = renderPanel(props);

    const input = root.querySelector<HTMLInputElement>(".mp-add-row__input");
    expect(input).not.toBeNull();
    if (!input) {
      return;
    }
    input.value = "deepseek-chat";
    const addButtons = root.querySelectorAll<HTMLButtonElement>(".mp-add-row .btn");
    addButtons[addButtons.length - 1].click();

    expect(props.onPatch).toHaveBeenCalledWith(
      ["models", "providers", "deepseek", "models"],
      [expect.objectContaining({ id: "deepseek-chat" })],
    );
  });
});
