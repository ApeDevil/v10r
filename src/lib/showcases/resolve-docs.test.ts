import { describe, expect, it } from 'vitest';
import { resolveShowcaseDocs } from './resolve-docs';

describe('resolveShowcaseDocs', () => {
	it('resolves docs seeded on a top-level card', () => {
		expect(resolveShowcaseDocs('/showcases/jobs')).toEqual([
			{ href: '/docs/blueprint/architecture/jobs', label: 'Jobs' },
		]);
	});

	it('resolves docs seeded on a sublink via exact match', () => {
		expect(resolveShowcaseDocs('/showcases/ui/tokens')).toEqual([
			{ href: '/docs/blueprint/design/tokens', label: 'Tokens' },
		]);
	});

	it('falls back to the nearest ancestor with docs for a deeper path', () => {
		// No card/sublink is registered for this exact path, but the 'ui/tokens'
		// sublink itself has no descendants — use a card-level ancestor instead.
		expect(resolveShowcaseDocs('/showcases/jobs/anything/deeper')).toEqual([
			{ href: '/docs/blueprint/architecture/jobs', label: 'Jobs' },
		]);
	});

	it('inherits the parent card docs for a leaf sublink that carries none of its own', () => {
		// 'viz/charts' has no `docs` of its own, but the 'viz' card does — the
		// ancestor-fallback must surface the card's docs rather than [].
		expect(resolveShowcaseDocs('/showcases/viz/charts')).toEqual([{ href: '/docs/stack/viz', label: 'Data Viz' }]);
	});

	it('returns [] when no node in the entire tree matches, even ancestrally', () => {
		// Every registered card now carries `docs`, so no real showcase path
		// bottoms out at [] anymore via ancestor fallback — this exercises a
		// pathname with no showcase-tree node at all.
		expect(resolveShowcaseDocs('/showcases/nonexistent')).toEqual([]);
	});

	it('returns [] for a path outside the showcase tree entirely', () => {
		expect(resolveShowcaseDocs('/admin/jobs')).toEqual([]);
	});

	it('does not treat a sibling segment as an ancestor match', () => {
		// '/showcases/db' has no docs, but must not accidentally match
		// '/showcases/db-other' via naive string prefixing.
		expect(resolveShowcaseDocs('/showcases/db-other')).toEqual([]);
	});
});
