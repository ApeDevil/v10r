/**
 * SNIPPET-RULES REGISTRY GATE (docs-mapping.gate.test.ts pattern).
 *
 * The rules are data in mcp/snippet-rules.json, so nothing in the type system proves
 * they are well-formed, that their doc links are real, or that the {{COLOR_TOKENS}}
 * expansion actually happened. Each of those failure modes is silent at runtime —
 * a rule that quietly stops firing looks exactly like clean code.
 */
import { describe, expect, it } from 'vitest';
import { resolveMarkdownRequest } from '../../docs/markdown-urls';
import { COLOR_TOKEN_COUNT, MAX_SNIPPET_CHARS, SNIPPET_RULES } from './rules';

describe('snippet rules gate', () => {
	it('carries a real rule set (sentinel against an empty or truncated JSON)', () => {
		expect(SNIPPET_RULES.length).toBeGreaterThan(5);
	});

	it('every rule is well-formed with a unique id', () => {
		const seen = new Set<string>();
		for (const rule of SNIPPET_RULES) {
			expect(seen.has(rule.id), `duplicate rule id '${rule.id}'`).toBe(false);
			seen.add(rule.id);
			expect(rule.message.length, rule.id).toBeGreaterThan(10);
			expect(rule.fix.length, rule.id).toBeGreaterThan(10);
			expect(rule.languages.length, rule.id).toBeGreaterThan(0);
			expect(rule.re, rule.id).toBeInstanceOf(RegExp);
		}
	});

	// Same idea as "every showcase docs href must resolve": a rule citing a blocked or
	// renamed doc would hand agents a dead link, and nothing else would notice.
	it('every docs link resolves to a published markdown page', () => {
		for (const rule of SNIPPET_RULES) {
			expect(rule.docs, rule.id).toMatch(/^\/docs\/.+\.md$/);
			expect(resolveMarkdownRequest(rule.docs), `${rule.id} → ${rule.docs}`).not.toBeNull();
		}
	});

	// The input is caller-controlled up to MAX_SNIPPET_CHARS on an unauthenticated
	// endpoint with a 10s budget — a backtracking blowup would be a free CPU burn.
	it('no rule regex degrades on pathological 20k inputs', () => {
		const pathological = ['a'.repeat(MAX_SNIPPET_CHARS), '<'.repeat(MAX_SNIPPET_CHARS), '#'.repeat(MAX_SNIPPET_CHARS)];
		for (const rule of SNIPPET_RULES) {
			for (const input of pathological) {
				const start = performance.now();
				rule.re.lastIndex = 0;
				rule.re.exec(input);
				expect(performance.now() - start, rule.id).toBeLessThan(50);
			}
		}
	});

	it('the color-token expansion actually ran (app.css inlining did not break)', () => {
		// ~42 unique --color-* names today (declarations repeat across theme blocks; the
		// alternation needs unique names). A collapse toward zero means the loader broke.
		expect(COLOR_TOKEN_COUNT).toBeGreaterThan(30);
		const tokenRule = SNIPPET_RULES.find((rule) => rule.id === 'token-opacity');
		expect(tokenRule).toBeDefined();
		expect(tokenRule?.re.source).not.toContain('{{COLOR_TOKENS}}');
		expect(tokenRule?.re.source).not.toContain('no-color-tokens-loaded');
	});
});
