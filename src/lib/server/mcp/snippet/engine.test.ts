import { describe, expect, it } from 'vitest';
import { publicPatternRegistry } from '../patterns/tools';
import { renderReport, validateSnippet } from './engine';
import { MAX_FINDINGS, MAX_SNIPPET_CHARS, RULE_FIXTURES, SNIPPET_RULES } from './rules';

describe('validateSnippet — shared fixtures (the hosted↔stdio behavioral parity guard)', () => {
	// The fixtures live in mcp/snippet-rules.json next to the rules themselves; the stdio
	// smoke run replays them against the live server, so a rule change that shifts behavior
	// must update the fixture both engines read.
	it('every fixture produces exactly its expected rule ids', () => {
		expect(RULE_FIXTURES.length).toBeGreaterThan(10);
		for (const fixture of RULE_FIXTURES) {
			const report = validateSnippet(fixture.snippet, fixture.language);
			const ids = [...new Set(report.findings.map((finding) => finding.ruleId))].sort();
			expect(ids, fixture.name).toEqual([...fixture.expect].sort());
		}
	});

	it('every rule id is exercised by at least one fixture', () => {
		const exercised = new Set(RULE_FIXTURES.flatMap((fixture) => fixture.expect));
		for (const rule of SNIPPET_RULES) {
			expect(exercised.has(rule.id), `rule '${rule.id}' has no fixture`).toBe(true);
		}
	});
});

describe('renderReport', () => {
	it('never echoes snippet content — line:column only', () => {
		const marker = 'VERY_DISTINCTIVE_IDENTIFIER_THAT_MUST_NOT_LEAK';
		const snippet = `<script>\nexport let ${marker};\nconst x = '#ff0000';\n</script>`;
		const report = renderReport(validateSnippet(snippet, 'svelte'));
		expect(report).not.toContain(marker);
		// No substring of the input longer than 20 chars may appear in the report.
		for (let index = 0; index + 20 <= snippet.length; index += 7) {
			expect(report).not.toContain(snippet.slice(index, index + 20));
		}
	});

	it('a clean snippet reads as clean and invites the loop', () => {
		const report = renderReport(validateSnippet('<p>hello</p>', 'svelte'));
		expect(report).toContain('No issues found');
	});

	it('findings carry severity, position, fix and docs link', () => {
		const report = renderReport(validateSnippet('<button>x</button>', 'svelte'));
		expect(report).toMatch(/\[error\] raw-element at 1:1/);
		expect(report).toContain('Fix: ');
		expect(report).toContain('https://www.v10r.dev/docs/');
		expect(report).toContain('call validate_snippet again');
	});

	it('is deterministic', () => {
		const snippet = RULE_FIXTURES.map((fixture) => fixture.snippet).join('\n');
		expect(renderReport(validateSnippet(snippet, 'svelte'))).toBe(renderReport(validateSnippet(snippet, 'svelte')));
	});

	it('truncates at MAX_FINDINGS and says so', () => {
		const dirty = Array.from({ length: MAX_FINDINGS + 10 }, () => '<button>x</button>').join('\n');
		const report = validateSnippet(dirty, 'svelte');
		expect(report.findings.length).toBe(MAX_FINDINGS);
		expect(report.truncatedFindings).toBe(true);
		expect(renderReport(report)).toContain(`Stopped at ${MAX_FINDINGS} findings`);
	});
});

describe('the registry tool contract', () => {
	it('refuses an over-length snippet rather than truncating it', async () => {
		const result = await publicPatternRegistry.dispatch('validate_snippet', {
			snippet: 'x'.repeat(MAX_SNIPPET_CHARS + 1),
		});
		expect(result.isError).toBe(true);
		expect(result.diag).toBe('invalid_args');
		expect(result.content[0].text).toContain('Refused rather than truncated');
	});

	it('treats findings as a SUCCESS — no isError, no diag', async () => {
		const result = await publicPatternRegistry.dispatch('validate_snippet', {
			snippet: '<button>x</button>',
			language: 'svelte',
		});
		expect(result.isError).toBeUndefined();
		expect(result.diag).toBeUndefined();
		expect(result.content[0].text).toContain('raw-element');
	});

	it('treats a clean snippet as a success too', async () => {
		const result = await publicPatternRegistry.dispatch('validate_snippet', { snippet: '<p>fine</p>' });
		expect(result.isError).toBeUndefined();
		expect(result.content[0].text).toContain('No issues found');
	});
});
