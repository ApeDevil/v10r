/**
 * One record, one row. A source may return the same entity twice (GLEIF's fuzzy
 * completions repeat its full-text hits), and two spellings of one registration are
 * noise, not evidence. The first occurrence wins unless a later one scores higher —
 * sources list their richer records first for exactly this reason.
 */
import type { NameMatch } from '$lib/name-check/report';

function identity(match: NameMatch): string {
	return `${match.kind}:${match.sourceId}:${match.externalId ?? match.label.toLowerCase()}`;
}

export function dedupeMatches(matches: readonly NameMatch[]): NameMatch[] {
	const byIdentity = new Map<string, NameMatch>();
	for (const match of matches) {
		const key = identity(match);
		const existing = byIdentity.get(key);
		if (!existing || match.similarity.score > existing.similarity.score) byIdentity.set(key, match);
	}
	return [...byIdentity.values()];
}
