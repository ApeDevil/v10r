/**
 * Unit tests for buildOverviewBody — the deterministic system-overview anchor body.
 *
 * The load-bearing guard is the **Stack:** line. loadOverview() truncates the body to
 * OVERVIEW_MAX_TOKENS * CHARS_PER_TOKEN (= 2000) chars before injecting it into the chat
 * system prompt. The stack summary therefore has to land in the FIRST 2000 chars — ahead of
 * the large per-section TOC — or the chatbot can no longer answer "which stack does v10r
 * use?" (the original grounding bug). These tests pin that invariant.
 */
import { describe, expect, it } from 'vitest';
import { OVERVIEW_MAX_TOKENS } from '../llmwiki/config';
import { buildOverviewBody, type OverviewDocFile } from './overview-body';

const MAX_CHARS = OVERVIEW_MAX_TOKENS * 4; // mirrors loadOverview's CHARS_PER_TOKEN = 4

const stackDoc = (subsection: string, file: string, title: string): OverviewDocFile => ({
	sourcePath: `docs/stack/${subsection}/${file}.md`,
	docsPath: `/docs/stack/${file}`,
	title,
});

/** A realistic file set: huge `blueprint` TOC (sorts before stack) + a handful of stack docs. */
const files: OverviewDocFile[] = [
	{ sourcePath: 'docs/foundation/PRD.md', docsPath: '/docs/foundation/prd', title: 'Product Requirements' },
	// Padding so the `## stack` TOC section is pushed well past the 2000-char ceiling, exactly
	// as the real (huge) blueprint section does in production.
	...Array.from({ length: 40 }, (_, i) => ({
		sourcePath: `docs/blueprint/area/topic-${i}.md`,
		docsPath: `/docs/blueprint/area/topic-${i}`,
		title: `Blueprint topic number ${i} with a deliberately long padding title to fill space`,
	})),
	// Core stack docs — their titles ARE the technologies.
	stackDoc('core', 'bun', 'Bun'),
	stackDoc('core', 'sveltekit', 'SvelteKit'),
	stackDoc('data', 'drizzle', 'Drizzle'),
	stackDoc('auth', 'better-auth', 'Better Auth'),
	stackDoc('ui', 'unocss', 'UnoCSS'),
	// Capability / ops subsections — present in docs/stack but NOT part of the stack summary.
	stackDoc('capabilities', 'seo', 'SEO & GEO'),
	stackDoc('ops', 'hosting', 'Hosting'),
];

describe('buildOverviewBody', () => {
	it('emits a Stack line derived from the core stack-section doc titles', () => {
		const body = buildOverviewBody(files);
		expect(body).toContain('**Stack:** Better Auth · Bun · Drizzle · SvelteKit · UnoCSS');
	});

	it('excludes capability/ops subsections from the Stack line', () => {
		const stackLine = buildOverviewBody(files)
			.split('\n')
			.find((l) => l.startsWith('**Stack:**'));
		expect(stackLine).toBeDefined();
		expect(stackLine).not.toContain('SEO & GEO');
		expect(stackLine).not.toContain('Hosting');
	});

	it('keeps the entire Stack line within the 2000-char truncation window', () => {
		const body = buildOverviewBody(files);
		const start = body.indexOf('**Stack:**');
		const end = body.indexOf('\n', start);
		expect(start).toBeGreaterThan(-1);
		expect(end).toBeGreaterThan(start);
		expect(end).toBeLessThan(MAX_CHARS); // whole line survives loadOverview truncation
	});

	it('demonstrates the fix: Stack line survives while the `## stack` TOC is truncated off', () => {
		const body = buildOverviewBody(files);
		// The intro stack summary lands early...
		expect(body.indexOf('**Stack:**')).toBeLessThan(MAX_CHARS);
		// ...whereas the per-section `## stack` heading (the old, truncated location) does not.
		expect(body.indexOf('\n## stack\n')).toBeGreaterThan(MAX_CHARS);
	});

	it('still appends the per-section TOC below the intro, unchanged', () => {
		const body = buildOverviewBody(files);
		expect(body).toContain('## foundation');
		expect(body).toContain('## blueprint');
		expect(body).toContain('## stack');
		expect(body).toContain('- Bun (/docs/stack/bun)');
	});

	it('omits the Stack line entirely when no stack docs are present', () => {
		const body = buildOverviewBody([
			{ sourcePath: 'docs/foundation/PRD.md', docsPath: '/docs/foundation/prd', title: 'Product Requirements' },
		]);
		expect(body).not.toContain('**Stack:**');
	});
});
