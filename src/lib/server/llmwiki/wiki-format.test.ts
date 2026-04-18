/**
 * Pure unit tests for llmwiki prompt-context formatting.
 * No DB access — exercises escape behaviour, shape, and composition.
 */
import { describe, expect, it } from 'vitest';
import type { LlmwikiHit, LlmwikiPage } from './types';
import { formatHitsForPrompt, formatLlmwikiContext, formatOverviewForPrompt } from './wiki-format';

const samplePointer = (n: number) => ({
	chunkId: `chk_${n}`,
	documentId: `doc_a`,
	documentTitle: 'Better Auth Docs',
	weight: 1 - n * 0.1,
});

const sampleHit = (overrides: Partial<LlmwikiHit> = {}): LlmwikiHit => ({
	slug: 'oauth-pkce',
	title: 'OAuth PKCE Flow',
	tldr: 'PKCE pins a public client to its token request via code_verifier/code_challenge.',
	tags: ['auth', 'oauth'],
	coverage: { sourceCount: 4, stale: false },
	pointers: [samplePointer(0), samplePointer(1)],
	...overrides,
});

describe('formatHitsForPrompt', () => {
	it('returns empty string for empty input', () => {
		expect(formatHitsForPrompt([])).toBe('');
	});

	it('includes slug, title, tldr, tags, coverage, and pointers', () => {
		const out = formatHitsForPrompt([sampleHit()]);
		expect(out).toContain('<llmwiki-hits>');
		expect(out).toContain('</llmwiki-hits>');
		expect(out).toContain('slug: oauth-pkce');
		expect(out).toContain('title: OAuth PKCE Flow');
		expect(out).toContain('tldr: PKCE pins');
		expect(out).toContain('tags: [auth, oauth]');
		expect(out).toContain('coverage: 4 sources, stale=false');
		expect(out).toContain('pointers:');
		expect(out).toContain('chk_0');
		expect(out).toContain('w=1.00');
		expect(out).toContain('w=0.90');
	});

	it('omits tags block when empty', () => {
		const out = formatHitsForPrompt([sampleHit({ tags: [] })]);
		expect(out).not.toContain('tags:');
	});

	it('omits pointers block when empty', () => {
		const out = formatHitsForPrompt([sampleHit({ pointers: [] })]);
		expect(out).not.toContain('pointers:');
	});

	it('collapses multi-line whitespace in tldr', () => {
		const out = formatHitsForPrompt([sampleHit({ tldr: 'line one\n\nline two\nline three' })]);
		expect(out).toContain('line one line two line three');
		expect(out).not.toContain('\n\nline two');
	});

	it('truncates long tldr', () => {
		const tldr = 'x'.repeat(600);
		const out = formatHitsForPrompt([sampleHit({ tldr })]);
		expect(out).toContain('…');
		expect(out).not.toContain('x'.repeat(600));
	});

	it('numbers hits starting at #1', () => {
		const out = formatHitsForPrompt([sampleHit({ slug: 'a' }), sampleHit({ slug: 'b' })]);
		expect(out).toMatch(/#1 slug: a/);
		expect(out).toMatch(/#2 slug: b/);
	});
});

describe('formatOverviewForPrompt', () => {
	it('returns empty when overview is null', () => {
		expect(formatOverviewForPrompt(null)).toBe('');
	});

	it('emits overview block with tldr and body', () => {
		const ov: LlmwikiPage = {
			slug: 'index',
			title: 'Overview',
			tldr: 'Knowledge base about authentication.',
			body: '# Overview\n\nMap of the wiki.',
			tags: [],
			coverage: { sourceCount: 0, stale: false },
			pointers: [],
			compiledAt: '2026-04-18T00:00:00.000Z',
			compiledByModel: 'groq:llama-3.3-70b-versatile',
		};
		const out = formatOverviewForPrompt(ov);
		expect(out).toContain('<llmwiki-overview>');
		expect(out).toContain('slug: index');
		expect(out).toContain('title: Overview');
		expect(out).toContain('tldr: Knowledge base about authentication.');
		expect(out).toContain('Map of the wiki.');
		expect(out).toContain('</llmwiki-overview>');
	});
});

describe('formatLlmwikiContext', () => {
	it('returns empty when both inputs are empty', () => {
		expect(formatLlmwikiContext(null, [])).toBe('');
	});

	it('joins overview and hits with blank line', () => {
		const ov: LlmwikiPage = {
			slug: 'index',
			title: 'Overview',
			tldr: 'Map.',
			body: '',
			tags: [],
			coverage: { sourceCount: 0, stale: false },
			pointers: [],
			compiledAt: '',
			compiledByModel: '',
		};
		const out = formatLlmwikiContext(ov, [sampleHit()]);
		expect(out).toContain('<llmwiki-overview>');
		expect(out).toContain('<llmwiki-hits>');
		expect(out.indexOf('<llmwiki-overview>')).toBeLessThan(out.indexOf('<llmwiki-hits>'));
	});
});
