// Control UI controller manages models gateway state.
import type { GatewayBrowserClient } from "../gateway.ts";
import type { ModelCatalogEntry } from "../types.ts";

const MODEL_CATALOG_CACHE_TTL_MS = 60_000;

type ModelCatalogView = "configured" | "all";

type ModelCatalogCacheEntry = {
  expiresAt: number;
  models: ModelCatalogEntry[];
  inFlight?: Promise<ModelCatalogEntry[]>;
};

const modelCatalogCache = new WeakMap<GatewayBrowserClient, ModelCatalogCacheEntry>();
const allModelCatalogCache = new WeakMap<GatewayBrowserClient, ModelCatalogCacheEntry>();

function cacheFor(view: ModelCatalogView): WeakMap<GatewayBrowserClient, ModelCatalogCacheEntry> {
  return view === "all" ? allModelCatalogCache : modelCatalogCache;
}

async function loadModelsForView(
  client: GatewayBrowserClient,
  view: ModelCatalogView,
): Promise<ModelCatalogEntry[]> {
  const cache = cacheFor(view);
  const cached = cache.get(client);
  const now = Date.now();
  if (cached?.models && cached.expiresAt > now) {
    return cached.models;
  }
  if (cached?.inFlight) {
    return cached.inFlight;
  }

  const inFlight = requestModels(client, view, cached?.models).finally(() => {
    const latest = cache.get(client);
    if (latest?.inFlight === inFlight) {
      delete latest.inFlight;
    }
  });
  cache.set(client, {
    expiresAt: cached?.expiresAt ?? 0,
    models: cached?.models ?? [],
    inFlight,
  });
  return inFlight;
}

/**
 * Fetch the configured model catalog from the gateway.
 *
 * Accepts a {@link GatewayBrowserClient} (matching the existing ui/ controller
 * convention).  Returns an array of {@link ModelCatalogEntry}; on failure the
 * caller receives an empty array rather than throwing.
 */
export async function loadModels(client: GatewayBrowserClient): Promise<ModelCatalogEntry[]> {
  return await loadModelsForView(client, "configured");
}

/**
 * Fetch the full model catalog (every provider in the bundled catalog, not just
 * configured ones). Used by the model-provider panel so a newly added provider
 * can still offer its known models even before anything is configured.
 */
export async function loadAllModels(client: GatewayBrowserClient): Promise<ModelCatalogEntry[]> {
  return await loadModelsForView(client, "all");
}

export function applyModelCatalogResult(models: unknown): ModelCatalogEntry[] | null {
  if (!Array.isArray(models)) {
    return null;
  }
  return models as ModelCatalogEntry[];
}

/**
 * Drop the cached model catalogs for a client so the next {@link loadModels} or
 * {@link loadAllModels} call re-fetches them. Call this after writing
 * `models.providers` so a newly added provider shows up in the chat model
 * picker and the provider panel immediately.
 */
export function invalidateModelCatalog(client: GatewayBrowserClient): void {
  modelCatalogCache.delete(client);
  allModelCatalogCache.delete(client);
}

async function requestModels(
  client: GatewayBrowserClient,
  view: ModelCatalogView,
  fallback: ModelCatalogEntry[] | undefined,
): Promise<ModelCatalogEntry[]> {
  try {
    const result = await client.request<{ models: ModelCatalogEntry[] }>("models.list", { view });
    const models = result?.models ?? [];
    cacheFor(view).set(client, {
      expiresAt: Date.now() + MODEL_CATALOG_CACHE_TTL_MS,
      models,
    });
    return models;
  } catch {
    return fallback ?? [];
  }
}
