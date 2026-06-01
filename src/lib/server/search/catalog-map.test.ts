import { describe, expect, it } from 'vitest';
import { formatCatalogMap } from './catalog-map';

describe('formatCatalogMap', () => {
	const map = formatCatalogMap('en');

	it('is wrapped and carries surface counts', () => {
		expect(map).toContain('<catalog-map>');
		expect(map).toContain('</catalog-map>');
		expect(map).toMatch(/pages \d+/);
		expect(map).toMatch(/showcases \d+/);
		expect(map).toMatch(/docs \d+/);
	});

	it('is PATH-FREE — no exact route leaks into the prompt', () => {
		// A path-bearing map becomes a stale oracle the verifier can't catch.
		expect(map).not.toMatch(/\/showcases\//);
		expect(map).not.toMatch(/\/docs\//);
		expect(map).not.toMatch(/href=/);
	});

	it('stays compact (≈120 tokens → well under ~200 words)', () => {
		expect(map.split(/\s+/).length).toBeLessThan(120);
	});

	it('instructs the model to call the tool for paths', () => {
		expect(map).toContain('search_catalog');
	});
});
