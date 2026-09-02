/**
 * Pure resolver mapping a de-localized showcase pathname to the `/docs/...`
 * links registered against the nearest ancestor node in the showcase tree.
 *
 * No SvelteKit imports — callers (the `ShowcaseDocs` composite) own
 * de-localizing `page.url.pathname` before calling in.
 */
import { type ShowcaseDocLink, showcases } from './registry';

interface DocsNode {
	href: string;
	docs?: ShowcaseDocLink[];
}

function segments(pathname: string): string[] {
	return pathname.split('/').filter(Boolean);
}

/** True when `hrefSegments` is a prefix of (or equal to) `pathSegments`. */
function isAncestorOrSelf(hrefSegments: string[], pathSegments: string[]): boolean {
	if (hrefSegments.length > pathSegments.length) return false;
	return hrefSegments.every((segment, i) => segment === pathSegments[i]);
}

function* walkTree(): Generator<DocsNode> {
	for (const card of showcases) {
		yield card;
		for (const sublink of card.sublinks ?? []) {
			yield sublink;
			for (const child of sublink.children ?? []) {
				yield child;
			}
		}
	}
}

/**
 * Resolves the doc links for the deepest showcase-tree node whose `href` is
 * an ancestor of (or exact match for) `pathname`. Exact match wins outright —
 * it necessarily has the longest possible segment count. Otherwise the
 * nearest ancestor carrying `docs` wins. Returns `[]` when nothing matches.
 */
export function resolveShowcaseDocs(pathname: string): ShowcaseDocLink[] {
	const pathSegments = segments(pathname);

	let best: DocsNode | undefined;
	let bestDepth = -1;

	for (const node of walkTree()) {
		if (!node.docs || node.docs.length === 0) continue;

		const hrefSegments = segments(node.href);
		if (!isAncestorOrSelf(hrefSegments, pathSegments)) continue;

		if (hrefSegments.length > bestDepth) {
			best = node;
			bestDepth = hrefSegments.length;
		}
	}

	return best?.docs ?? [];
}
