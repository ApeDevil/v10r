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
	for (const section of ['foundation', 'blueprint', 'stack', 'pattern-library'] as const) {
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
		const links = allNodes.flatMap((node) => (node.docs ?? []).map((link) => ({ node, link })));

		it('collects a non-empty set of docs links', () => {
			expect(links.length).toBeGreaterThan(0);
		});

		it('every docs href starts with /docs/', () => {
			const offenders = links
				.filter(({ link }) => !link.href.startsWith('/docs/'))
				.map(({ node, link }) => `${node.href} → ${link.href}`);
			expect(offenders).toEqual([]);
		});

		it('every docs href resolves to a published manifest entry (not blocked/draft/missing)', () => {
			const offenders = links
				.filter(({ link }) => !validDocUrls.has(link.href))
				.map(({ node, link }) => `${node.href} → ${link.href}`);
			expect(offenders).toEqual([]);
		});

		it('every docs label is non-empty and at most 3 words', () => {
			const offenders = links
				.filter(({ link }) => link.label !== undefined)
				.filter(({ link }) => {
					const trimmed = (link.label as string).trim();
					return trimmed.length === 0 || trimmed.split(/\s+/).length > 3;
				})
				.map(({ node, link }) => `${node.href} → ${link.href} — label ${JSON.stringify(link.label)}`);
			expect(offenders).toEqual([]);
		});
	});

	describe('COVERAGE — every leaf showcase route resolves to >= 1 doc link', () => {
		/**
		 * Explicit, commented exception list. Empty as of this writing: every
		 * top-level card in `registry.ts` now carries its own `docs`, so
		 * `resolveShowcaseDocs`'s ancestor-fallback guarantees every leaf resolves
		 * to at least the owning card's docs, even leaves with no `docs` of their
		 * own. A future leaf under a card that forgets to seed `docs` must fail
		 * the check below loudly, NOT get silently swallowed — do not add an entry
		 * here to silence that failure without also verifying the gap is
		 * intentional.
		 */
		const UNDOCUMENTED_SHOWCASES: string[] = [];

		const leaves = leafHrefs();
		const documentedLeaves = leaves.filter((href) => !UNDOCUMENTED_SHOWCASES.includes(href));

		it('collects a non-empty set of leaf hrefs', () => {
			expect(leaves.length).toBeGreaterThan(0);
		});

		it('every documented leaf resolves to at least one doc link', () => {
			const offenders = documentedLeaves.filter((href) => resolveShowcaseDocs(href).length < 1);
			expect(offenders).toEqual([]);
		});

		// Anti-rot, not a tautology: asserting the list is empty would only restate a
		// literal declared above. This is what fails once somebody DOES add an entry
		// and the gap later closes.
		it('every entry in UNDOCUMENTED_SHOWCASES is a real leaf that genuinely resolves to []', () => {
			const notALeaf = UNDOCUMENTED_SHOWCASES.filter((href) => !leaves.includes(href));
			const nowResolves = UNDOCUMENTED_SHOWCASES.filter((href) => resolveShowcaseDocs(href).length > 0);
			expect(notALeaf, 'stale exception entries — not real leaf hrefs').toEqual([]);
			expect(nowResolves, 'these now resolve docs — remove them from the exception list').toEqual([]);
		});
	});

	describe('NO-DEAD-WEIGHT — no node repeats its nearest docs-bearing ancestor exactly', () => {
		const docsBearingNodes = allNodes
			.filter((n) => n.docs && n.docs.length > 0)
			.map((n) => ({ href: n.href, seg: segments(n.href), docsSeq: hrefSeq(n.docs) }));

		it('collects a non-empty set of docs-bearing nodes', () => {
			expect(docsBearingNodes.length).toBeGreaterThan(0);
		});

		it('no node repeats its nearest docs-bearing ancestor exactly', () => {
			const offenders: string[] = [];
			for (const node of docsBearingNodes) {
				const ancestors = docsBearingNodes.filter(
					(other) => other.seg.length < node.seg.length && other.seg.every((s, i) => s === node.seg[i]),
				);
				if (ancestors.length === 0) continue;
				const nearest = ancestors.reduce((a, b) => (b.seg.length > a.seg.length ? b : a));
				if (node.docsSeq === nearest.docsSeq) offenders.push(`${node.href} repeats ${nearest.href}`);
			}
			expect(offenders).toEqual([]);
		});
	});
});
