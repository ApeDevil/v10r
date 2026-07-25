/**
 * DOCS-MAPPING GATE — fails the suite if the showcase→docs mapping in
 * `registry.ts` regresses in any of three ways:
 *
 *   1. VALIDITY     — a `docs` href points at a doc that isn't actually
 *                      published (typo'd slug, blocked path, draft doc), or
 *                      carries a malformed label.
 *   2. COVERAGE     — a leaf showcase route (a page a visitor can actually
 *                      land on) resolves to zero doc links via
 *                      `resolveShowcaseDocs`, i.e. the `ShowcaseDocs`
 *                      composite silently renders nothing.
 *   3. NO-DEAD-WEIGHT — a node re-declares the exact same doc set its nearest
 *                      docs-bearing ancestor already carries, which
 *                      `resolveShowcaseDocs`'s ancestor-fallback would have
 *                      supplied for free (see `resolve-docs.ts`).
 *
 * Ground truth for "real, published doc" is `getManifest()` — the same
 * function the `/docs/*` routes call via `renderDoc()` — NOT a filesystem
 * existence check, so a blocked/draft/README doc still fails here even
 * though the `.md` file is present on disk.
 */
import { describe, expect, it } from 'vitest';
import { getManifest } from '$lib/server/docs/manifest';
import { type ShowcaseDocLink, showcases } from './registry';
import { resolveShowcaseDocs } from './resolve-docs';

interface FlatNode {
	href: string;
	docs?: ShowcaseDocLink[];
}

/**
 * Walks the full showcase tree in the same shape `resolve-docs.ts`'s own
 * (unexported) `walkTree` consumes: each card, then each of its sublinks,
 * then each sublink's children. Reimplemented locally rather than exported
 * from `resolve-docs.ts` so this gate stays an independent check against the
 * resolver's behavior, not a shared-implementation echo of it.
 */
function flattenTree(): FlatNode[] {
	const out: FlatNode[] = [];
	for (const card of showcases) {
		out.push(card);
		for (const sublink of card.sublinks ?? []) {
			out.push(sublink);
			for (const child of sublink.children ?? []) {
				out.push(child);
			}
		}
	}
	return out;
}

/** Leaf hrefs: cards with no sublinks, sublinks with no children, and every child. */
function leafHrefs(): string[] {
	const leaves = new Set<string>();
	for (const card of showcases) {
		if (!card.sublinks || card.sublinks.length === 0) {
			leaves.add(card.href);
			continue;
		}
		for (const sublink of card.sublinks) {
			if (!sublink.children || sublink.children.length === 0) {
				leaves.add(sublink.href);
				continue;
			}
			for (const child of sublink.children) {
				leaves.add(child.href);
			}
		}
	}
	return [...leaves];
}

function segments(pathname: string): string[] {
	return pathname.split('/').filter(Boolean);
}

function hrefSeq(docs: ShowcaseDocLink[] | undefined): string[] {
	return (docs ?? []).map((d) => d.href);
}

describe('showcase → docs mapping gate', () => {
	const allNodes = flattenTree();
	const manifest = getManifest();

	const validDocUrls = new Set<string>();
	for (const section of ['foundation', 'blueprint', 'stack'] as const) {
		for (const entry of manifest[section]) {
			validDocUrls.add(`/docs/${section}/${entry.slug}`);
		}
	}

	it('scans a non-empty registry tree', () => {
		expect(allNodes.length).toBeGreaterThan(0);
	});

	it('the manifest has entries in all three sections (sanity — an empty manifest would make every VALIDITY check below a false positive)', () => {
		expect(manifest.foundation.length).toBeGreaterThan(0);
		expect(manifest.blueprint.length).toBeGreaterThan(0);
		expect(manifest.stack.length).toBeGreaterThan(0);
	});

	describe('VALIDITY — every docs href resolves to a real, published doc', () => {
		for (const node of allNodes) {
			for (const link of node.docs ?? []) {
				it(`${node.href} → "${link.href}" starts with /docs/`, () => {
					expect(link.href.startsWith('/docs/'), link.href).toBe(true);
				});

				it(`${node.href} → "${link.href}" resolves to a published manifest entry (not blocked/draft/missing)`, () => {
					expect(validDocUrls.has(link.href), `"${link.href}" not found in the published docs manifest`).toBe(true);
				});

				if (link.label !== undefined) {
					const label = link.label;
					it(`${node.href} → "${link.href}" label "${label}" is non-empty and <= 3 words`, () => {
						const trimmed = label.trim();
						expect(trimmed.length, 'label must not be empty/whitespace').toBeGreaterThan(0);
						expect(trimmed.split(/\s+/).length, `label "${label}" exceeds 3 words`).toBeLessThanOrEqual(3);
					});
				}
			}
		}
	});

	describe('COVERAGE — every leaf showcase route resolves to >= 1 doc link', () => {
		/**
		 * Explicit, commented exception list. Empty as of this writing: every
		 * top-level card in `registry.ts` now carries its own `docs`, so
		 * `resolveShowcaseDocs`'s ancestor-fallback guarantees every leaf resolves
		 * to at least the owning card's docs, even leaves with no `docs` of their
		 * own. A future leaf under a card that forgets to seed `docs` must fail
		 * the loop below loudly, NOT get silently swallowed — do not add an entry
		 * here to silence that failure without also verifying the gap is
		 * intentional.
		 */
		const UNDOCUMENTED_SHOWCASES: string[] = [];

		const leaves = leafHrefs();
		const documentedLeaves = leaves.filter((href) => !UNDOCUMENTED_SHOWCASES.includes(href));

		it('collects a non-empty set of leaf hrefs', () => {
			expect(leaves.length).toBeGreaterThan(0);
		});

		for (const href of documentedLeaves) {
			it(`${href} resolves to >= 1 doc link`, () => {
				expect(resolveShowcaseDocs(href).length).toBeGreaterThanOrEqual(1);
			});
		}

		it('UNDOCUMENTED_SHOWCASES is currently empty (every card carries docs)', () => {
			expect(UNDOCUMENTED_SHOWCASES).toEqual([]);
		});

		it('every entry in UNDOCUMENTED_SHOWCASES (if any) is a real leaf that genuinely resolves to []', () => {
			for (const href of UNDOCUMENTED_SHOWCASES) {
				expect(leaves, `"${href}" is not a real leaf href — stale exception entry`).toContain(href);
				expect(resolveShowcaseDocs(href), `"${href}" now resolves docs — remove it from the exception list`).toEqual(
					[],
				);
			}
		});
	});

	describe('NO-DEAD-WEIGHT — no node repeats its nearest docs-bearing ancestor exactly', () => {
		const docsBearingNodes = allNodes
			.filter((n) => n.docs && n.docs.length > 0)
			.map((n) => ({ href: n.href, seg: segments(n.href), docsSeq: hrefSeq(n.docs) }));

		it('collects a non-empty set of docs-bearing nodes', () => {
			expect(docsBearingNodes.length).toBeGreaterThan(0);
		});

		for (const node of docsBearingNodes) {
			const ancestors = docsBearingNodes.filter(
				(other) => other.seg.length < node.seg.length && other.seg.every((s, i) => s === node.seg[i]),
			);
			if (ancestors.length === 0) continue;

			const nearest = ancestors.reduce((a, b) => (b.seg.length > a.seg.length ? b : a));

			it(`${node.href} docs differ from nearest docs-bearing ancestor ${nearest.href}`, () => {
				expect(node.docsSeq).not.toEqual(nearest.docsSeq);
			});
		}
	});
});
