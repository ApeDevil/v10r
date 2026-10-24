import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DocSection } from '#lib/docs/types.ts';
import { isBlocked, slugify } from '#lib/server/docs/doc-filter.ts';
import { getEntry } from '#lib/server/docs/manifest.ts';
import { ROOT_DOCS } from '#lib/server/docs/markdown-urls.ts';
import { CATEGORIES, PATTERNS } from '#lib/server/patterns/index.ts';

/**
 * Dead-link gate for the generated pattern surfaces: every docs ref in the
 * registry either resolves to a PUBLISHED manifest entry (so the generated
 * pages/README can link it) or is deliberately unlinkable (blocked doc, dir
 * ref, or a non-docs repo path) — in which case the renderer emits a code span.
 * A ref that would have become a dead `/docs` link on every generated page fails
 * here instead.
 */

interface Ref {
	patternId: string;
	path: string;
	kind?: string;
}

const DOC_REFS: Ref[] = PATTERNS.flatMap((pattern) =>
	pattern.docs.map((ref) => ({ patternId: pattern.id, path: ref.path.split('#')[0], kind: ref.kind })),
);

/** Non-docs repo paths a docs ref may legitimately point at (rendered unlinked). */
const NON_DOCS_ALLOWED = new Set(['README.md']);

function resolvesInManifest(path: string): boolean {
	const parts = path.split('/');
	if (parts.length === 2) {
		return ROOT_DOCS.some((doc) => doc.sourcePath === path);
	}
	const section = parts[1];
	if (section !== 'foundation' && section !== 'blueprint' && section !== 'stack' && section !== 'pattern-library') {
		return false;
	}
	const slug =
		section === 'blueprint'
			? parts.slice(2).join('/').replace(/\.md$/, '')
			: slugify(parts[parts.length - 1].replace(/\.md$/, ''));
	const entry = getEntry(section as DocSection, slug);
	// Guard slug collisions too: the resolved entry must be THIS file, not a
	// same-named sibling that happened to win the flattened slug.
	return entry !== null && entry.sourcePath === path;
}

describe('pattern registry docs refs', () => {
	it('has at least one docs ref per pattern (validator contract)', () => {
		for (const pattern of PATTERNS) {
			expect(pattern.docs.length, pattern.id).toBeGreaterThan(0);
		}
	});

	it('every docs ref is either linkable in the /docs manifest or deliberately unlinkable', () => {
		const problems: string[] = [];
		for (const ref of DOC_REFS) {
			if (ref.kind === 'dir') continue; // rendered as a code span by design
			if (!ref.path.startsWith('docs/')) {
				if (!NON_DOCS_ALLOWED.has(ref.path)) {
					problems.push(`${ref.patternId}: non-docs ref '${ref.path}' is not in the allowed set`);
				}
				continue;
			}
			if (isBlocked(ref.path)) continue; // blocked docs render as code spans by design
			if (!resolvesInManifest(ref.path)) {
				problems.push(`${ref.patternId}: '${ref.path}' does not resolve to a published /docs manifest entry`);
			}
		}
		expect(problems, problems.join('\n')).toEqual([]);
	});
});

/**
 * The Velocity coverage matrix routes each performance concern to the record that covers
 * it. Its Record column (third) must name real registry ids, and every Velocity record must
 * appear — a renamed record or a new one nobody placed in the matrix fails here.
 */
describe('velocity coverage matrix', () => {
	const COVERAGE_DOC = 'docs/blueprint/velocity/coverage.md';
	const recordCells = readFileSync(join(process.cwd(), COVERAGE_DOC), 'utf8')
		.split('\n')
		.filter((line) => line.startsWith('| ') && !line.startsWith('|---'))
		.map((line) => line.split('|')[3] ?? '');
	const named = new Set(recordCells.flatMap((cell) => [...cell.matchAll(/`([a-z0-9-]+)`/g)].map((match) => match[1])));
	const velocityCategories = new Set(CATEGORIES.filter((category) => category.group === 'velocity').map((c) => c.id));

	it('names only registry records', () => {
		const known = new Set(PATTERNS.map((pattern) => pattern.id));
		const unknown = [...named].filter((id) => !known.has(id));
		expect(unknown, `${COVERAGE_DOC} names unknown records`).toEqual([]);
	});

	it('places every Velocity record', () => {
		const missing = PATTERNS.filter(
			(pattern) => velocityCategories.has(pattern.category) && !named.has(pattern.id),
		).map((pattern) => pattern.id);
		expect(missing, `${COVERAGE_DOC} omits Velocity records`).toEqual([]);
	});
});
