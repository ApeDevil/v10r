/**
 * Agent-registry drift.
 *
 * `registry.ts` globs `.claude/agents/*.md` and feeds the public `/docs/programming` pages
 * with whatever it finds. A file added, renamed or deleted there changes the public docs
 * silently; this hand-maintained list makes that change a failing test instead. Adding an
 * agent means adding it here in the same change — a missing file and an unlisted file are
 * equally drift.
 */
import { describe, expect, it } from 'vitest';
import { getAgentRegistry } from './registry';

const EXPECTED_AGENT_IDS = [
	'aiy',
	'apy',
	'arty',
	'ary',
	'clyn',
	'cony',
	'daty',
	'docy',
	'laly',
	'resy',
	'scout',
	'secy',
	'svey',
	'sys',
	'tesy',
	'tray',
	'uxy',
	'visy',
] as const;

describe('agent registry drift', () => {
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
