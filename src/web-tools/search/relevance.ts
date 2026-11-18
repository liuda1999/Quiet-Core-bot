/**
 * Query-relevance guard for scraped search results.
 *
 * Bing's HTML endpoint answers a query it cannot match with a "popular
 * results" module (and sometimes single-character CJK matches) instead of an
 * empty list. Feeding those to the model is worse than returning nothing,
 * because the fallback chain only advances on an empty result set.
 *
 * The guard is deliberately permissive: one shared meaningful token is enough
 * to keep a source. It removes only results that have no lexical overlap with
 * the query at all.
 *
 * @module dsh-web-kit/search/relevance
 */

import type { WebSearchSource } from '../types.js'

/** Latin/number tokens shorter than this carry no signal. */
const MIN_LATIN_TOKEN = 2
/** CJK queries are matched with bigrams; a single character matches too much. */
const CJK_RUN = /[\u3400-\u4dbf\u4e00-\u9fff]+/gu
const LATIN_RUN = /[a-z0-9][a-z0-9._+-]*/gu
/** Query syntax and host fragments that must not become relevance tokens. */
const OPERATOR_TOKEN =
  /^(site|filetype|intitle|inurl|intext|related|or|and|not|com|org|net|www|http|https)$/u

/** Extracts the tokens used to decide whether a result is on-topic. */
export function queryRelevanceTokens(query: string): string[] {
  const normalized = query.toLowerCase()
  const tokens = new Set<string>()

  for (const run of normalized.match(LATIN_RUN) ?? []) {
    if (run.length < MIN_LATIN_TOKEN) continue
    if (OPERATOR_TOKEN.test(run)) continue
    tokens.add(run)
  }

  for (const run of normalized.match(CJK_RUN) ?? []) {
    // A single CJK character ("年", "月") matches nearly every Chinese page, so
    // only bigrams carry signal. Queries that are one character long end up
    // with no tokens, and the guard then leaves results untouched.
    if (run.length === 1) continue
    for (let index = 0; index + 1 < run.length; index += 1) {
      tokens.add(run.slice(index, index + 2))
    }
  }

  return [...tokens]
}

/**
 * Drops sources that share no token with the query.
 *
 * Returns the input untouched when the query has no usable tokens (pure
 * punctuation, operators only), so the guard can never blank out an
 * unfilterable query.
 */
export function filterByQueryRelevance(
  query: string,
  sources: readonly WebSearchSource[],
): WebSearchSource[] {
  const tokens = queryRelevanceTokens(query)
  if (tokens.length === 0) return [...sources]

  // Bare numbers ("2026", "11") appear on almost every page, including the
  // popular-results filler Bing substitutes for a query it cannot match. They
  // only count when the query has nothing else to match on.
  const distinctive = tokens.filter(token => !/^\d+$/u.test(token))
  const active = distinctive.length > 0 ? distinctive : tokens

  return sources.filter(source => {
    const haystack = `${source.title} ${source.snippet ?? ''} ${source.url}`.toLowerCase()
    return active.some(token => haystack.includes(token))
  })
}

/** True when the query is mostly CJK, which is where scrapers degrade most. */
export function isCjkQuery(query: string): boolean {
  const cjkChars = query.match(CJK_RUN)?.join('').length ?? 0
  const meaningful = query.replace(/\s+/gu, '').length
  return meaningful > 0 && cjkChars / meaningful > 0.5
}
