/**
 * Agent-registry drift.
 *
 * `index.ts` and `registry.ts` each run their OWN `import.meta.glob` over
 * `.claude/agents/*.md`, and only `index.ts` checks the result against a
 * hand-maintained list. `registry.ts` has no check at all yet feeds the public
 * `/docs/programming` pages — so the two can silently disagree.
 *
 * Asserting `getAgentIds() === EXPECTED_AGENT_IDS` would be vacuous: the getter
 * throws on mismatch, so it can only ever return a passing value. These tests
 * compare across the two modules instead, which is the invariant that can break.
 */
import { describe, expect, it } from 'vitest';
import { EXPECTED_AGENT_IDS, getAgentIds } from './index';
import { getAgentRegistry } from './registry';

describe('agent registry drift', () => {
	it('both glob consumers see the same agent ids', () => {
		const fromRegistry = getAgentRegistry()
			.map((r) => r.id)
			.sort();
		expect(getAgentIds()).toEqual(fromRegistry);
	});

	it('EXPECTED_AGENT_IDS covers every agent the docs pages render', () => {
		const rendered = getAgentRegistry()
			.map((r) => r.id)
			.sort();
		expect([...EXPECTED_AGENT_IDS].sort()).toEqual(rendered);
	});

	it('lists no duplicates', () => {
		expect(new Set(EXPECTED_AGENT_IDS).size).toBe(EXPECTED_AGENT_IDS.length);
	});
});
