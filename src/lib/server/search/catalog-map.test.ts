import { describe, expect, it } from 'vitest';
import { navItems } from '#lib/nav/index.ts';
import { formatCatalogMap, SECTION_PURPOSE } from './catalog-map';

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
		expect(map).not.toMatch(/\/workflows/);
		expect(map).not.toMatch(/\/studio/);
		expect(map).not.toMatch(/href=/);
	});

	it('gives every top-level nav section a purpose, so a new section cannot go unexplained', () => {
		for (const item of navItems) expect(SECTION_PURPOSE[item.href], item.href).toBeTruthy();
	});

	it('outlines each section with the pages under it, by group', () => {
		const line = (title: string) => map.split('\n').find((l) => l.startsWith(`- ${title}:`)) ?? '';
		expect(line('Home')).toContain('Velociraptor');
		expect(line('Workflows')).toContain('Office: Set up a folder for AI work');
		expect(line('Workflows')).toContain('Analyse and transform an Excel sheet with AI');
		expect(line('Studio')).toContain('Architecture Engineering: Overview · Explore · Design · Engineer');
		expect(line('Showcases')).toContain('Dynamic Attributes');
		expect(line('Showcases')).toContain('Desk');
		expect(line('Showcases')).toContain('3D');
		expect(line('Docs')).toContain('Pattern Library');
	});

	it('is localized: a German prompt names the German labels the catalog matches', () => {
		expect(formatCatalogMap('de')).not.toContain('Set up a folder for AI work');
	});

	it('stays compact (well under ~450 words in the cache-stable prefix)', () => {
		expect(map.split(/\s+/).length).toBeLessThan(450);
	});
});
