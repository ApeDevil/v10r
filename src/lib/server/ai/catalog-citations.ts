/**
 * Surface-citation verifier — cheap, pure, no DB.
 *
 * After the model answers, flag every project route it emitted against the catalog:
 *  - `exists`  — the `search_catalog` tool surfaced this path THIS turn (grounded).
 *  - `drifted` — a real catalog path the model recalled WITHOUT surfacing it (risky).
 *  - `none`    — looks like an internal route but isn't a catalog path (hallucination
 *                candidate, or a legit non-catalog ref like `/api/...`).
 *
 * Belt-and-suspenders on top of the tool-output-only prompt rule: `strict` schemas
 * govern tool INPUT, not the prose the model writes — so a post-hoc check is still
 * the only thing that catches a fabricated path in the answer text.
 */

export type CatalogCitationStatus = 'exists' | 'drifted' | 'none';

export interface CatalogVerdict {
	path: string;
	status: CatalogCitationStatus;
}

export interface CatalogCitationSummary {
	total: number;
	exists: number;
	drifted: number;
	none: number;
}

export interface CatalogCitationResult {
	verdicts: CatalogVerdict[];
	summary: CatalogCitationSummary;
}

// Internal-route candidates: a leading slash (not protocol-relative `//`), a path-ish
// run, optional anchor. Markdown link parens/brackets are not part of the match.
const ROUTE_RE = /(?<![\w/])\/(?!\/)[a-z0-9][a-z0-9\-/]*(?:#[a-z0-9-]+)?/gi;

/** Locale-bare, anchor-stripped, trailing-slash-free — so paths compare canonically. */
export function normalizeCatalogPath(raw: string): string {
	let p = raw.replace(/#.*$/, '');
	p = p.replace(/^\/(?:de|ru)(?=\/|$)/, '');
	if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
	return p;
}

export function verifyCatalogCitations(
	answerText: string,
	surfacedPaths: Set<string>,
	knownPaths: Set<string>,
): CatalogCitationResult {
	const seen = new Set<string>();
	const verdicts: CatalogVerdict[] = [];
	for (const m of answerText.matchAll(ROUTE_RE)) {
		const path = normalizeCatalogPath(m[0]);
		if (path.length < 2 || seen.has(path)) continue;
		seen.add(path);
		const status: CatalogCitationStatus = surfacedPaths.has(path)
			? 'exists'
			: knownPaths.has(path)
				? 'drifted'
				: 'none';
		verdicts.push({ path, status });
	}
	const summary: CatalogCitationSummary = {
		total: verdicts.length,
		exists: verdicts.filter((v) => v.status === 'exists').length,
		drifted: verdicts.filter((v) => v.status === 'drifted').length,
		none: verdicts.filter((v) => v.status === 'none').length,
	};
	return { verdicts, summary };
}
