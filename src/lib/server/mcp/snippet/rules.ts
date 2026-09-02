/**
 * Rule loading for the hosted validate_snippet tool.
 *
 * The rules and their fixtures live in `mcp/snippet-rules.json`, shared with the stdio
 * server the same way `registry.json` is: one JSON, two runtimes, zero cross-
 * imports of `.ts` between `mcp/` and `src/`. The `{{COLOR_TOKENS}}` placeholder in the
 * token-opacity rule is expanded at load time from `src/app.css` (inlined into the
 * bundle via the same `?raw` glob technique as the docs corpus), so the 480 color tokens
 * have exactly one source of truth and there is no generated artifact to keep in sync.
 */
import { readFileSync } from 'node:fs';
import rulesJson from '../../../../../mcp/snippet-rules.json';

const cssModules = import.meta.glob('/src/app.css', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>;

/**
 * Vitest stubs every CSS module to an empty string (`css: false` default) — including
 * `?raw` — so under the test runner the glob value is ''. There the filesystem exists,
 * so read the same file directly; in the Vercel bundle the glob value is inlined at
 * build time and the fallback never fires (and would return '' harmlessly if it did —
 * the rules.gate.test token-count assertion is what keeps this loader honest).
 */
function loadAppCss(): string {
	const fromGlob = cssModules['/src/app.css'] ?? '';
	if (fromGlob.length > 0) return fromGlob;
	try {
		return readFileSync('src/app.css', 'utf8');
	} catch {
		return '';
	}
}

export type SnippetLanguage = 'svelte' | 'ts';
export type SnippetSeverity = 'error' | 'warn';

export interface SnippetRule {
	id: string;
	severity: SnippetSeverity;
	languages: readonly SnippetLanguage[];
	re: RegExp;
	skipIf: readonly string[];
	message: string;
	fix: string;
	docs: string;
}

export interface RuleFixture {
	name: string;
	language: SnippetLanguage;
	snippet: string;
	expect: readonly string[];
}

export const MAX_SNIPPET_CHARS: number = rulesJson.maxSnippetChars;
export const MAX_FINDINGS: number = rulesJson.maxFindings;
export const RULE_FIXTURES: readonly RuleFixture[] = rulesJson.fixtures as RuleFixture[];

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Same extraction regex as scripts/quality/no-token-opacity.ts — longest token first so
 *  `primary-hover` is tried before `primary` in the alternation. */
export function extractColorTokens(css: string): string[] {
	const tokens = new Set<string>();
	for (const match of css.matchAll(/--color-([a-z0-9-]+)\s*:/g)) tokens.add(match[1]);
	return [...tokens].sort((a, b) => b.length - a.length);
}

const COLOR_TOKENS = extractColorTokens(loadAppCss());

/** Exposed for the gate test: a token count collapse means the app.css inlining broke. */
export const COLOR_TOKEN_COUNT = COLOR_TOKENS.length;

export function compileRules(tokens: readonly string[]): SnippetRule[] {
	// An empty alternation would make the regex match everywhere; an inert sentinel keeps
	// it valid and never-matching. The gate test asserts the count so this cannot happen
	// silently on the hosted side.
	const alternation = tokens.length > 0 ? tokens.map(escapeRe).join('|') : 'no-color-tokens-loaded';
	return rulesJson.rules.map((rule) => ({
		id: rule.id,
		severity: rule.severity as SnippetSeverity,
		languages: rule.languages as SnippetLanguage[],
		re: new RegExp(rule.pattern.replace('{{COLOR_TOKENS}}', alternation), rule.flags),
		skipIf: rule.skipIf,
		message: rule.message,
		fix: rule.fix,
		docs: rule.docs,
	}));
}

export const SNIPPET_RULES: readonly SnippetRule[] = compileRules(COLOR_TOKENS);
