/** One quota window reported by a provider usage endpoint. */
export type UsageWindow = {
  label: string;
  usedPercent: number;
  resetAt?: number;
};

export type ProviderUsageSnapshot = {
  provider: UsageProviderId;
  displayName: string;
  windows: UsageWindow[];
  summary?: string;
  plan?: string;
  error?: string;
};

export type UsageSummary = {
  updatedAt: number;
  providers: ProviderUsageSnapshot[];
};

// Usage snapshots are plugin-owned: any provider id may supply one through the
// provider-usage plugin hooks, so the id set is open.
export type UsageProviderId = string;
