// Singleton tests: one kit per process, rebuilt when the option fingerprint changes.
import { beforeEach, describe, expect, it, vi } from "vitest";

const createWebKit = vi.hoisted(() => vi.fn());
vi.mock("./index.js", () => ({ createWebKit }));

import { disposeWebKit, getWebKit } from "./kit-singleton.js";

interface FakeKit {
  readonly marker: number;
  readonly dispose: ReturnType<typeof vi.fn>;
}

function fakeKit(marker: number): FakeKit {
  return { marker, dispose: vi.fn(async () => undefined) };
}

beforeEach(async () => {
  await disposeWebKit();
  createWebKit.mockReset();
});

describe("getWebKit", () => {
  it("reuses the kit for the same fingerprint", () => {
    const kit = fakeKit(1);
    createWebKit.mockReturnValue(kit);
    expect(getWebKit({}, "same")).toBe(kit);
    expect(getWebKit({}, "same")).toBe(kit);
    expect(createWebKit).toHaveBeenCalledTimes(1);
  });

  it("rebuilds and disposes the previous kit when the fingerprint changes", async () => {
    const first = fakeKit(1);
    const second = fakeKit(2);
    createWebKit.mockReturnValueOnce(first).mockReturnValueOnce(second);

    expect(getWebKit({}, "a")).toBe(first);
    expect(getWebKit({}, "b")).toBe(second);
    await Promise.resolve();
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(second.dispose).not.toHaveBeenCalled();
  });

  it("disposes once and is safe to call repeatedly", async () => {
    const kit = fakeKit(1);
    createWebKit.mockReturnValue(kit);
    getWebKit({}, "a");
    await disposeWebKit();
    await disposeWebKit();
    expect(kit.dispose).toHaveBeenCalledTimes(1);
  });
});
