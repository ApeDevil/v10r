/**
 * Maps an app locale to a Postgres full-text-search configuration.
 *
 * The SAME config must be used at write time (`to_tsvector`) and query time
 * (`websearch_to_tsquery`) or stemming mismatches silently drop hits. Unknown
 * locales fall back to `simple` (no stemming — safe exact-token matching).
 * Returns a static picklist value — never interpolate user input as a regconfig.
 *
 * Dependency-free on purpose: `scripts/db/setup-search.ts` reaches it by relative path
 * under bare Bun, so the backfill and the insert path cannot drift apart.
 */
export type Regconfig = 'english' | 'german' | 'russian' | 'simple';

const MAP: Record<string, Regconfig> = {
	en: 'english',
	de: 'german',
	ru: 'russian',
};

export function localeRegconfig(locale: string): Regconfig {
	return MAP[locale] ?? 'simple';
}
