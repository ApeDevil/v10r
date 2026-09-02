import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PATTERN_TOOLS } from './tools';

/**
 * Drift guard between the two runtimes. The stdio server (`mcp/tools.ts`) and this hosted
 * registry deliberately keep separate copies of the pattern-tool logic (the container has no
 * `$lib` alias / bundler). This test reads the stdio source as TEXT — the same technique the
 * showcase drift test uses — and asserts the public tool SET is identical, so a tool added to
 * or renamed in one runtime cannot silently diverge from the other.
 */
describe('hosted ↔ stdio pattern-tool parity', () => {
	const stdioSource = readFileSync('mcp/tools.ts', 'utf8');
	const stdioToolNames = new Set([...stdioSource.matchAll(/name:\s*'([a-z_]+)'/g)].map((m) => m[1]));
	const hostedToolNames = PATTERN_TOOLS.map((t) => t.name);

	it('exposes the same six tool names in both runtimes', () => {
		expect([...stdioToolNames].sort()).toEqual([...hostedToolNames].sort());
	});

	it('has exactly six public pattern tools', () => {
		expect(hostedToolNames).toHaveLength(6);
	});

	// The tool SET check above cannot catch a field rendered in one runtime's card
	// but not the other's. Pin the maturity line the same way — by source text —
	// in both copies of patternCard.
	it('renders the maturity grade in both runtimes', () => {
		const hostedSource = readFileSync('src/lib/server/mcp/patterns/tools.ts', 'utf8');
		for (const source of [stdioSource, hostedSource]) {
			expect(source).toContain('**Maturity:** ${pattern.maturity}');
			expect(source).toContain('${hit.pattern.tier}, ${hit.pattern.maturity}');
		}
	});
});
