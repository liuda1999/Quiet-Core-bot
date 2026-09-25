// Verifies the "local egress proxy is not running" hint fires only for refused
// connections to a loopback managed proxy, and never for real network failures.
import { createServer } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  registerActiveManagedProxyUrl,
  resetActiveManagedProxyStateForTests,
} from "./active-proxy-state.js";
import {
  classifyManagedProxyConnectionFailure,
  formatManagedProxyConnectionFailureHint,
  formatManagedProxyUnreachableHint,
  getManagedProxyLiveness,
  probeManagedProxyLiveness,
  recordManagedProxyLiveness,
  resetManagedProxyLivenessForTests,
  resolveManagedProxyUnreachableStartHint,
} from "./managed-proxy-unreachable-hint.js";

describe("managed proxy unreachable hint", () => {
  const envKeys = [
    "http_proxy",
    "https_proxy",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "OPENCLAW_PROXY_ACTIVE",
  ] as const;

  beforeEach(() => {
    resetActiveManagedProxyStateForTests();
    resetManagedProxyLivenessForTests();
    for (const key of envKeys) {
      vi.stubEnv(key, "");
    }
  });

  afterEach(() => {
    resetActiveManagedProxyStateForTests();
    resetManagedProxyLivenessForTests();
    vi.unstubAllEnvs();
  });

  it("points at the proxy start command when the active loopback proxy refuses", () => {
    registerActiveManagedProxyUrl(new URL("http://127.0.0.1:18888"));
    expect(formatManagedProxyUnreachableHint("connect ECONNREFUSED 127.0.0.1:18888")).toBe(
      "LLM request failed: the local egress proxy http://127.0.0.1:18888 is not reachable. " +
        "Start it with: quiet-core-bot proxy start --host 127.0.0.1 --port 18888",
    );
  });

  it("recovers the proxy URL from inherited env in child processes", () => {
    vi.stubEnv("OPENCLAW_PROXY_ACTIVE", "1");
    vi.stubEnv("HTTP_PROXY", "http://127.0.0.1:18888");
    expect(formatManagedProxyUnreachableHint("connection refused")).toContain(
      "quiet-core-bot proxy start --host 127.0.0.1 --port 18888",
    );
  });

  it.each(["Connection error.", "TypeError: fetch failed", "network request failed"])(
    "treats the SDK's generic connection failures as transient while liveness is unknown: %s",
    (raw) => {
      registerActiveManagedProxyUrl(new URL("http://127.0.0.1:18888"));
      const hint = formatManagedProxyConnectionFailureHint(raw);
      expect(hint).toContain("did not complete this request");
      expect(hint).not.toContain("is not reachable");
      expect(hint).not.toContain("quiet-core-bot proxy start");
    },
  );

  it("still points at the proxy start command for a refused connection", () => {
    registerActiveManagedProxyUrl(new URL("http://127.0.0.1:18888"));
    expect(
      formatManagedProxyConnectionFailureHint("connect ECONNREFUSED 127.0.0.1:18888"),
    ).toContain("quiet-core-bot proxy start --host 127.0.0.1 --port 18888");
  });

  it("reports transient while the endpoint answers and refuses once a probe finds it down", () => {
    // C-4b: a locked state database or port race fails the request while the
    // proxy keeps listening, so liveness - not the error text - decides.
    registerActiveManagedProxyUrl(new URL("http://127.0.0.1:18888"));

    recordManagedProxyLiveness("up");
    expect(formatManagedProxyConnectionFailureHint("Connection error.")).toContain(
      "did not complete this request",
    );

    recordManagedProxyLiveness("down");
    expect(formatManagedProxyConnectionFailureHint("Connection error.")).toContain(
      "quiet-core-bot proxy start --host 127.0.0.1 --port 18888",
    );
  });

  it("classifies refusal signatures apart from transient connection failures", () => {
    expect(classifyManagedProxyConnectionFailure("connect ECONNREFUSED 127.0.0.1:18888")).toBe(
      "refused",
    );
    expect(classifyManagedProxyConnectionFailure("connect EADDRINUSE")).toBe("transient");
    expect(classifyManagedProxyConnectionFailure("TypeError: fetch failed")).toBe("transient");
    expect(classifyManagedProxyConnectionFailure("getaddrinfo ENOTFOUND host")).toBeUndefined();
  });

  it.each([
    ["127.0.0.1:18888", "http://127.0.0.1:18888"],
    ["localhost", "http://localhost:18888"],
    ["[::1]:18888", "http://[::1]:18888"],
  ])("treats %s as loopback", (label, proxyUrl) => {
    registerActiveManagedProxyUrl(new URL(proxyUrl));
    expect(formatManagedProxyUnreachableHint("Error: connect ECONNREFUSED " + label)).toBeDefined();
  });

  it("stays silent when no managed proxy is active", () => {
    expect(
      formatManagedProxyUnreachableHint("connect ECONNREFUSED 127.0.0.1:11434"),
    ).toBeUndefined();
  });

  it("stays silent when the active proxy endpoint is not loopback", () => {
    registerActiveManagedProxyUrl(new URL("http://egress.internal:3128"));
    expect(formatManagedProxyUnreachableHint("connect ECONNREFUSED 10.0.0.5:3128")).toBeUndefined();
  });

  it.each([
    "LLM request timed out.",
    "getaddrinfo ENOTFOUND api.example.com",
    "socket hang up",
    "connect ECONNRESET 127.0.0.1:18888",
  ])("stays silent for non-refusal transport errors: %s", (raw) => {
    registerActiveManagedProxyUrl(new URL("http://127.0.0.1:18888"));
    expect(formatManagedProxyUnreachableHint(raw)).toBeUndefined();
  });

  it("re-probes the active loopback proxy with bounded backoff and caches liveness", async () => {
    registerActiveManagedProxyUrl(new URL("http://127.0.0.1:18888"));
    const attempts: Array<{ host: string; port: number }> = [];
    const connect = vi.fn(async (params: { host: string; port: number; timeoutMs: number }) => {
      attempts.push({ host: params.host, port: params.port });
      // First probe is refused; the endpoint answers on the retry.
      return attempts.length >= 2;
    });

    await expect(probeManagedProxyLiveness({ connect, attempts: 3, delayMs: 1 })).resolves.toBe(
      "up",
    );
    expect(attempts).toEqual([
      { host: "127.0.0.1", port: 18888 },
      { host: "127.0.0.1", port: 18888 },
    ]);
    expect(getManagedProxyLiveness()).toBe("up");
  });

  it("records the endpoint as down after exhausting probe attempts", async () => {
    registerActiveManagedProxyUrl(new URL("http://127.0.0.1:18888"));
    const connect = vi.fn(async () => false);

    await expect(probeManagedProxyLiveness({ connect, attempts: 3, delayMs: 1 })).resolves.toBe(
      "down",
    );
    expect(connect).toHaveBeenCalledTimes(3);
    expect(getManagedProxyLiveness()).toBe("down");
  });

  it("does not probe when no loopback managed proxy is active", async () => {
    const connect = vi.fn(async () => true);

    await expect(probeManagedProxyLiveness({ connect })).resolves.toBe("down");
    expect(connect).not.toHaveBeenCalled();
  });

  it("detects a listening loopback endpoint with the real socket probe", async () => {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    try {
      const port = typeof address === "object" && address ? address.port : 0;
      await expect(
        probeManagedProxyLiveness({
          proxyUrl: new URL(`http://127.0.0.1:${port}`),
          attempts: 1,
          delayMs: 0,
          timeoutMs: 500,
        }),
      ).resolves.toBe("up");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // C-K2-2: a model-catalog failure caused by the proxy being down is reported as a
  // model/auth problem, so the error text carries no connection-failure signature.
  // The hint for that path is probe-gated instead of text-gated.
  it("adds the proxy start command after a probe proves the endpoint is down", async () => {
    registerActiveManagedProxyUrl(new URL("http://127.0.0.1:18888"));
    const connect = vi.fn(async () => false);

    await expect(
      resolveManagedProxyUnreachableStartHint({ connect, attempts: 1, delayMs: 0 }),
    ).resolves.toContain("quiet-core-bot proxy start --host 127.0.0.1 --port 18888");
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("stays silent when a probe finds the endpoint answering", async () => {
    registerActiveManagedProxyUrl(new URL("http://127.0.0.1:18888"));
    const connect = vi.fn(async () => true);

    await expect(
      resolveManagedProxyUnreachableStartHint({ connect, attempts: 1, delayMs: 0 }),
    ).resolves.toBeUndefined();
  });

  it("stays silent when no loopback managed proxy is active", async () => {
    const connect = vi.fn(async () => false);

    await expect(resolveManagedProxyUnreachableStartHint({ connect })).resolves.toBeUndefined();
    expect(connect).not.toHaveBeenCalled();
  });
});
