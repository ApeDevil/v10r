/**
 * Unit tests for buildOverviewBody — the deterministic body of the project docs corpus map.
 *
 * The load-bearing guard is the **Stack:** line. loadProjectMap() cuts the body to
 * PROJECT_MAP_MAX_CHARS (2000) before injecting it into the chat system prompt. The stack
 * summary therefore has to land in the FIRST 2000 chars — ahead of the large per-section
 * TOC — or the chatbot can no longer answer "which stack does v10r use?" (the original
 * grounding bug). These tests pin that invariant.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_MAP_MAX_CHARS } from '$lib/server/ai/config';
import { buildOverviewBody, type OverviewDocFile } from './overview-body';

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
	it('emits a Stack line derived from the core stack-section doc titles, inside the prompt cut', () => {
		const body = buildOverviewBody(files);
		const stack = '**Stack:** Better Auth · Bun · Drizzle · SvelteKit · UnoCSS';
		expect(body).toContain(stack);
		expect(body.indexOf(stack) + stack.length).toBeLessThan(PROJECT_MAP_MAX_CHARS);
	});

	it('excludes capability/ops subsections from the Stack line', () => {
		const stackLine = buildOverviewBody(files)
			.split('\n')
			.find((l) => l.startsWith('**Stack:**'));
		expect(stackLine).toBeDefined();
		expect(stackLine).not.toContain('SEO & GEO');
		expect(stackLine).not.toContain('Hosting');
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
