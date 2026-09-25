// Turns a failed provider connection into an actionable hint when the failure
// came from the Quiet Core bot-managed egress proxy instead of the provider endpoint.
//
// Under a managed proxy every provider request connects to the proxy first, so
// a dead proxy process surfaces to the caller as a plain connection failure that
// otherwise reads like the provider endpoint is down. Two guards keep this from
// misreporting a genuine network fault:
//
// - The proxy must be active *and* bound to a loopback endpoint. A refusal that
//   reaches a remote host is never attributed to a local process.
// - The error must be connection-level. When the proxy is listening but the
//   upstream origin is unreachable, the proxy answers with an HTTP 502 instead,
//   so a connection-level failure while a loopback proxy is active means the
//   proxy endpoint itself is what could not be reached.
import { connect as netConnect } from "node:net";
import { resolveEnvHttpProxyUrl } from "../proxy-env.js";
import { getActiveManagedProxyUrl } from "./active-proxy-state.js";

const CONNECTION_FAILURE_PATTERNS = [
  "econnrefused",
  "connection refused",
  "actively refused",
  "fetch failed",
  "connection error",
  "network request failed",
  // A busy/locked local resource can surface as a bind/connect address error
  // (observed with a locked state database while the proxy kept listening).
  "eaddr",
] as const;

/**
 * Connection-level signatures that prove the proxy endpoint refused the
 * connection (nothing is listening). Everything else that still looks like a
 * connection failure is treated as transient: a live proxy can fail a request
 * while it is congested or while a shared local resource (for example the state
 * database) is locked, and that must not be reported as "the proxy is down".
 */
const PROXY_REFUSAL_PATTERNS = ["econnrefused", "connection refused", "actively refused"] as const;

const MANAGED_PROXY_LIVENESS_TTL_MS = 30_000;
const DEFAULT_PROBE_ATTEMPTS = 3;
const DEFAULT_PROBE_DELAY_MS = 150;
const DEFAULT_PROBE_TIMEOUT_MS = 1_000;

/** How a connection-level failure relates to the active managed proxy endpoint. */
export type ManagedProxyConnectionFailureKind = "refused" | "transient";

/** Liveness of the active managed proxy endpoint as observed by a probe. */
export type ManagedProxyLiveness = "up" | "down";

let managedProxyLiveness: { status: ManagedProxyLiveness; atMs: number } | undefined;

/** Records a fresh probe result for the active managed proxy endpoint. */
export function recordManagedProxyLiveness(status: ManagedProxyLiveness, nowMs?: number): void {
  managedProxyLiveness = { status, atMs: nowMs ?? Date.now() };
}

/** Last probe result while it is still fresh, or undefined when stale/unknown. */
export function getManagedProxyLiveness(nowMs?: number): ManagedProxyLiveness | undefined {
  if (!managedProxyLiveness) {
    return undefined;
  }
  return (nowMs ?? Date.now()) - managedProxyLiveness.atMs <= MANAGED_PROXY_LIVENESS_TTL_MS
    ? managedProxyLiveness.status
    : undefined;
}

export function resetManagedProxyLivenessForTests(): void {
  managedProxyLiveness = undefined;
}

function resolveHostnameForConnect(hostname: string): string {
  return hostname.trim().replace(/^\[|\]$/g, "");
}

type ManagedProxyConnectProbe = (params: {
  host: string;
  port: number;
  timeoutMs: number;
}) => Promise<boolean>;

function defaultConnectProbe(params: {
  host: string;
  port: number;
  timeoutMs: number;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const socket = netConnect({ host: params.host, port: params.port });
    const finish = (reachable: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      resolve(reachable);
    };
    socket.setTimeout(params.timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

/**
 * Quick re-probe of the active managed proxy endpoint with bounded backoff.
 *
 * A listen-only check distinguishes "the proxy process is gone" (refused) from
 * "the proxy answered the port but failed this particular request" (busy local
 * resource, port race). The result is cached briefly so downstream copy and
 * retries act on fresh evidence instead of a single error string.
 */
export async function probeManagedProxyLiveness(params?: {
  proxyUrl?: URL;
  attempts?: number;
  delayMs?: number;
  timeoutMs?: number;
  connect?: ManagedProxyConnectProbe;
}): Promise<ManagedProxyLiveness> {
  const proxyUrl = params?.proxyUrl ?? resolveActiveManagedProxyUrl();
  if (!proxyUrl || !isLoopbackHost(proxyUrl.hostname)) {
    return "down";
  }
  const attempts = Math.max(1, params?.attempts ?? DEFAULT_PROBE_ATTEMPTS);
  const delayMs = Math.max(0, params?.delayMs ?? DEFAULT_PROBE_DELAY_MS);
  const timeoutMs = Math.max(1, params?.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS);
  const connect = params?.connect ?? defaultConnectProbe;
  const host = resolveHostnameForConnect(proxyUrl.hostname);
  const port = Number(proxyUrl.port || (proxyUrl.protocol === "https:" ? 443 : 80));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await connect({ host, port, timeoutMs })) {
      recordManagedProxyLiveness("up");
      return "up";
    }
    if (attempt < attempts - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  recordManagedProxyLiveness("down");
  return "down";
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.+$/, "");
  return normalized === "localhost" || normalized === "::1" || normalized.startsWith("127.");
}

function resolveActiveManagedProxyUrl(): URL | undefined {
  const inProcess = getActiveManagedProxyUrl();
  if (inProcess) {
    return new URL(inProcess.href);
  }
  if (process.env["OPENCLAW_PROXY_ACTIVE"] !== "1") {
    return undefined;
  }
  // Child processes inherit only env, so recover the managed proxy URL the same
  // way the undici dispatcher does.
  const inherited = resolveEnvHttpProxyUrl("https") ?? resolveEnvHttpProxyUrl("http");
  if (!inherited) {
    return undefined;
  }
  try {
    return new URL(inherited);
  } catch {
    return undefined;
  }
}

function isConnectionFailureText(raw: string): boolean {
  const lower = raw.toLowerCase();
  return CONNECTION_FAILURE_PATTERNS.some((pattern) => lower.includes(pattern));
}

/** Text-classifies a connection failure against the active managed proxy. */
export function classifyManagedProxyConnectionFailure(
  raw: string,
): ManagedProxyConnectionFailureKind | undefined {
  if (!isConnectionFailureText(raw)) {
    return undefined;
  }
  const lower = raw.toLowerCase();
  return PROXY_REFUSAL_PATTERNS.some((pattern) => lower.includes(pattern))
    ? "refused"
    : "transient";
}

function resolveProxyPort(proxyUrl: URL): string {
  return proxyUrl.port || (proxyUrl.protocol === "https:" ? "443" : "80");
}

/** Transient-failure copy for a proxy endpoint that is still answering. */
function formatManagedProxyTransientHint(proxyUrl: URL): string {
  return (
    `LLM request failed: the local egress proxy ${proxyUrl.protocol}//${proxyUrl.hostname}:${resolveProxyPort(proxyUrl)} ` +
    `did not complete this request (transient local failure, for example a busy or locked local resource). ` +
    `The proxy endpoint itself still answers; retry, and run "quiet-core-bot proxy status" if it keeps failing`
  );
}

/** Actionable "start the local proxy" copy for the active managed endpoint. */
function formatManagedProxyUnreachableCopy(proxyUrl: URL): string {
  return (
    `LLM request failed: the local egress proxy ${proxyUrl.protocol}//${proxyUrl.hostname}:${resolveProxyPort(proxyUrl)} ` +
    `is not reachable. Start it with: quiet-core-bot proxy start --host ${proxyUrl.hostname} --port ${resolveProxyPort(proxyUrl)}`
  );
}

/** Returns the actionable "start the local proxy" copy, or undefined when the failure is not ours. */
export function formatManagedProxyUnreachableHint(raw: string): string | undefined {
  if (!isConnectionFailureText(raw)) {
    return undefined;
  }
  const proxyUrl = resolveActiveManagedProxyUrl();
  if (!proxyUrl || !isLoopbackHost(proxyUrl.hostname)) {
    return undefined;
  }
  return formatManagedProxyUnreachableCopy(proxyUrl);
}

/**
 * Probe-gated "start the local proxy" hint for failures that do not read as
 * connection failures on their own.
 *
 * A provider catalog or model-discovery request routed through the managed proxy
 * fails inside the provider plugin and is reported as a model/auth problem (for
 * example `Unknown model: … requires authentication`), so the original message
 * never names the proxy. This helper keeps that message and adds the executable
 * proxy step — but only when a live probe proves the active loopback endpoint is
 * actually down, so a healthy proxy is never blamed.
 */
export async function resolveManagedProxyUnreachableStartHint(params?: {
  proxyUrl?: URL;
  attempts?: number;
  delayMs?: number;
  timeoutMs?: number;
  connect?: ManagedProxyConnectProbe;
}): Promise<string | undefined> {
  const proxyUrl = params?.proxyUrl ?? resolveActiveManagedProxyUrl();
  if (!proxyUrl || !isLoopbackHost(proxyUrl.hostname)) {
    return undefined;
  }
  const liveness = await probeManagedProxyLiveness({ ...params, proxyUrl });
  return liveness === "down" ? formatManagedProxyUnreachableCopy(proxyUrl) : undefined;
}

/**
 * Liveness-aware proxy hint.
 *
 * Only claims the proxy "is not reachable" when the failure is a refusal, or
 * when a recent probe found the endpoint down. Generic connection failures on a
 * proxy that still answers are reported as transient so a state-database lock or
 * port race is never presented as a stopped proxy.
 */
export function formatManagedProxyConnectionFailureHint(raw: string): string | undefined {
  const kind = classifyManagedProxyConnectionFailure(raw);
  if (!kind) {
    return undefined;
  }
  const proxyUrl = resolveActiveManagedProxyUrl();
  if (!proxyUrl || !isLoopbackHost(proxyUrl.hostname)) {
    return undefined;
  }
  if (kind === "refused" || getManagedProxyLiveness() === "down") {
    return formatManagedProxyUnreachableHint(raw);
  }
  return formatManagedProxyTransientHint(proxyUrl);
}
