/**
 * `site:` operator support for scraped search backends.
 *
 * `cn.bing.com` and `www.bing.com` return their normal result set and silently
 * drop the operator, so passing the query through unchanged makes the model
 * believe filtered results were filtered when they were not. The constraint is
 * therefore enforced locally: strip the operator, bias the upstream query with
 * the host, then keep only sources inside the requested site.
 *
 * @module dsh-web-kit/search/site-filter
 */

/** One parsed `site:` constraint. */
export interface SiteFilter {
  /** Host to keep; lowercase, no scheme, no trailing dot. */
  readonly host: string
  /** Optional path prefix (`site:example.com/docs`). */
  readonly pathPrefix?: string
}

/** Query with every `site:` operator removed, plus the constraints it carried. */
export interface ParsedSiteQuery {
  readonly filters: readonly SiteFilter[]
  readonly rest: string
}

const SITE_OPERATOR = /\bsite:(\S+)/giu

function normalizeFilter(raw: string): SiteFilter | undefined {
  const withoutScheme = raw.replace(/^https?:\/\//iu, '').replace(/\/+$/u, '')
  const slash = withoutScheme.indexOf('/')
  const hostPart = (slash === -1 ? withoutScheme : withoutScheme.slice(0, slash)).toLowerCase()
  const pathPart = slash === -1 ? '' : withoutScheme.slice(slash)
  if (hostPart.length === 0) return undefined
  return {
    host: hostPart,
    ...pathPart.length > 0 ? { pathPrefix: pathPart } : {},
  }
}

/** Splits `site:` constraints out of a query. */
export function parseSiteQuery(query: string): ParsedSiteQuery {
  const filters: SiteFilter[] = []
  for (const match of query.matchAll(SITE_OPERATOR)) {
    const target = match[1]
    if (target === undefined) continue
    const filter = normalizeFilter(target)
    if (filter !== undefined) filters.push(filter)
  }
  const rest = query.replace(SITE_OPERATOR, ' ').replace(/\s+/gu, ' ').trim()
  return { filters, rest }
}

/** True when `hostname` is the filter host or a subdomain of it. */
function matchesHost(hostname: string, filterHost: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/u, '')
  return host === filterHost || host.endsWith(`.${filterHost}`)
}

/** Applies every site constraint to a source list. */
export function applySiteFilters<T extends { readonly url: string }>(
  sources: readonly T[],
  filters: readonly SiteFilter[],
): T[] {
  if (filters.length === 0) return [...sources]
  return sources.filter(source => {
    let parsed: URL
    try {
      parsed = new URL(source.url)
    } catch {
      return false
    }
    return filters.some(filter => {
      if (!matchesHost(parsed.hostname, filter.host)) return false
      if (filter.pathPrefix === undefined) return true
      return `${parsed.pathname}${parsed.search}`.startsWith(filter.pathPrefix)
    })
  })
}

/** Upstream query used to surface pages from the requested sites. */
export function biasedQuery(rest: string, filters: readonly SiteFilter[]): string {
  if (filters.length === 0) return rest
  const hosts = filters.map(filter => filter.host).join(' ')
  return rest.length > 0 ? `${rest} ${hosts}` : hosts
}
