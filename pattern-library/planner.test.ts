/**
 * The planner's contracts (discovery → selection → assembly) and the Slice 4 adversarial
 * fixtures, on the committed registry through the tool both MCP transports serve. A passing
 * suite here is necessary, not sufficient: the composition benchmark measures plan quality, and
 * a fresh evaluation the implementation was never tuned against measures generalization.
 */
import { describe, expect, it } from 'vitest';
import { REGISTRY } from '../src/lib/server/patterns/registry.ts';
import { compositionCondition, graphOf, needCondition } from './pattern-graph.ts';
import { assemble, discover, select } from './planner.ts';
import { recommendPlan } from './query.ts';

const plan = (args: Record<string, unknown>) => recommendPlan(REGISTRY, args);
const steps = (text: string) =>
	[...text.matchAll(/^### \d+\. (?:Implement|Perform)[^:]*: .*\(`([a-z0-9-]+)`\)/gm)].map((match) => match[1]);
const section = (text: string, heading: string) => text.split(`## ${heading}`)[1]?.split('\n## ')[0] ?? '';
const graph = graphOf(REGISTRY);

describe('discovery: what matched, by evidence class', () => {
	it('tells a name, a declared capability and a keyword apart', () => {
		expect(discover(REGISTRY, 'rate limiting')[0]).toMatchObject({ id: 'rate-limiting', evidence: 'name', exact: true });
		expect(discover(REGISTRY, 'grounded answers')[0]).toMatchObject({
			id: 'layered-rag',
			evidence: 'capability',
			matched: ['grounded answers'],
		});
		const magic = discover(REGISTRY, 'magic link login');
		expect(magic.find((candidate) => candidate.id === 'auth-forms')?.evidence).toBe('keyword');
		expect(magic.find((candidate) => candidate.id === 'passwordless-auth')?.evidence).toBe('capability');
	});
});

describe('selection: one record or an explicit ambiguity', () => {
	it('a declared capability outranks a louder keyword match', () => {
		const selection = select(REGISTRY, 'magic link login');
		expect(selection).toMatchObject({ status: 'selected', chosen: { id: 'passwordless-auth' } });
	});

	it('light records are eligible: every record is reachable by its title', () => {
		for (const record of REGISTRY.patterns) {
			const selection = select(REGISTRY, record.title);
			expect(selection.status === 'selected' && selection.chosen.id, record.id).toBe(record.id);
		}
	});

	it('an ambiguous request returns candidates, a reason and a recovery call — and adopts nothing for it', () => {
		const selection = select(REGISTRY, 'notifications');
		expect(selection.status).toBe('ambiguous');
		if (selection.status !== 'ambiguous') return;
		expect(selection.candidates.length).toBeGreaterThan(1);
		const text = plan({ capabilities: ['notifications'] }).text;
		expect(text).toContain('**ambiguous**, nothing adopted for it');
		expect(text).toContain('Recover: call again with "ids"');
	});

	it('no runner-up is adopted because its score is close', () => {
		// "hosted mcp": the MCP App provider scores close behind; only the exact record is a root.
		const text = plan({ capabilities: ['hosted mcp'] }).text;
		expect(steps(text)).toEqual(['rate-limiting', 'hosted-mcp']);
		expect(text).not.toContain('`mcp-app-provider`');
	});
});

describe('exact-id planning', () => {
	it('plans canonical ids in one deterministic call, whatever their order', () => {
		const a = plan({ ids: ['mcp-authorization', 'hosted-mcp'] });
		const b = plan({ ids: ['hosted-mcp', 'mcp-authorization'] });
		expect(a.ok).toBe(true);
		expect(a.text).toBe(b.text);
		// Shared parts appear once, with every reason kept.
		expect(steps(a.text).filter((id) => id === 'rate-limiting')).toHaveLength(1);
		expect(a.text).toMatch(/`hosted-mcp` builds on it; `mcp-authorization` builds on it|`mcp-authorization` builds on it; `hosted-mcp` builds on it/);
	});

	it('adds nothing outside the adoption closure of the ids', () => {
		for (const id of ['layered-rag', 'hosted-mcp', 'agentic-parametric-modeling', 'url-search-state']) {
			expect(steps(plan({ ids: [id] }).text).sort()).toEqual([...graph.adopt([id]).steps].sort());
		}
	});

	it('rejects or reports unknown ids — retired ids are never aliased', () => {
		const alone = plan({ ids: ['architecture-hosted-mcp'] });
		expect(alone.ok).toBe(false);
		if (!alone.ok) expect(alone.diag).toBe('not_found');
		const mixed = plan({ ids: ['hosted-mcp', 'no-such-record'] });
		expect(mixed.ok).toBe(true);
		expect(mixed.text).toContain('`no-such-record` — **unknown id**');
		expect(steps(mixed.text)).toEqual(['rate-limiting', 'hosted-mcp']);
	});

	it('ids and capabilities plan together; a capability that selects an id already named merges into it', () => {
		const text = plan({ ids: ['hosted-mcp'], capabilities: ['hosted mcp', 'background jobs'] }).text;
		expect(text).toContain('requested (by id, "hosted mcp")');
		expect(steps(text)).toContain('job-scheduling');
	});
});

describe('explicit requests and optional constituents', () => {
	it('an explicitly requested optional constituent is adopted, and its optional relationship stays visible', () => {
		const text = plan({ capabilities: ['grounded answers', 'graph rag'] }).text;
		expect(steps(text)).toEqual(['graph-rag', 'layered-rag']);
		expect(text).toContain('requested ("graph rag"); also an optional part of `layered-rag`');
	});

	it('a satisfied condition on an optional constituent does not select it', () => {
		const condition = compositionCondition('layered-rag', 'graph-rag');
		const text = plan({ ids: ['layered-rag'], conditions: [{ id: condition, state: 'satisfied' }] }).text;
		expect(steps(text)).toEqual(['layered-rag']);
		expect(text).toContain(`\`${condition}\`: satisfied, applies but not selected`);
		const selected = plan({ ids: ['layered-rag'], select: ['graph-rag'] }).text;
		expect(steps(selected)).toEqual(['graph-rag', 'layered-rag']);
		expect(selected).toContain('optional part of `layered-rag`, selected by the caller');
	});

	it('a satisfied condition on a conditional constituent makes it required; a decision keyed by the constituent settles nothing', () => {
		const condition = compositionCondition('asset-production-pipeline', 'hosted-mcp');
		const open = plan({ ids: ['asset-production-pipeline'] }).text;
		expect(steps(open)).not.toContain('hosted-mcp');
		expect(open).toContain('**Open decisions**');
		const settled = plan({ ids: ['asset-production-pipeline'], conditions: [{ id: condition, state: 'satisfied' }] }).text;
		expect(steps(settled)).toContain('hosted-mcp');
		expect(settled).toContain(`required because \`${condition}\` is satisfied`);
		const wrongKey = plan({ ids: ['asset-production-pipeline'], conditions: [{ id: 'hosted-mcp', state: 'satisfied' }] });
		expect(steps(wrongKey.text)).not.toContain('hosted-mcp');
		expect(wrongKey.text).toContain('Condition `hosted-mcp` is not met by this plan (ignored).');
	});

	it('conditional infrastructure stays conditional, with its condition', () => {
		const text = plan({ ids: ['stale-while-revalidate'] }).text;
		expect(section(text, 'Infrastructure')).toMatch(/Conditional .*key-value-store \(when /);
		expect(section(text, 'Infrastructure')).not.toMatch(/Required: key-value-store/);
		const kv = needCondition('stale-while-revalidate', 'key-value-store');
		const settled = plan({ ids: ['stale-while-revalidate'], conditions: [{ id: kv, state: 'satisfied' }] }).text;
		expect(section(settled, 'Infrastructure')).toMatch(/Required: key-value-store/);
	});
});

describe('target fitness', () => {
	it('an equivalent existing prerequisite is satisfied, not built again, and brings its own needs', () => {
		const text = plan({ ids: ['hosted-mcp'], target_has: ['rate-limiting'] }).text;
		expect(steps(text)).toEqual(['hosted-mcp']);
		expect(section(text, 'Already satisfied by the target (not built again)')).toContain('`rate-limiting`');
		expect(section(text, 'Infrastructure')).toContain('Required: none beyond the app runtime.');
	});

	it('missing mandatory infrastructure blocks the step and names what stands on it', () => {
		const text = plan({ ids: ['hosted-mcp'], target_lacks: ['key-value-store'] }).text;
		expect(text).toContain('1 blocked');
		expect(section(text, 'Blocked')).toContain('`rate-limiting` needs key-value-store, which the target lacks; affects `hosted-mcp`');
	});

	it('missing information is unknown, not absent', () => {
		const unknown = plan({ ids: ['hosted-mcp'] }).text;
		expect(unknown).toContain('target not described: every need is unknown for it');
		expect(unknown).not.toContain('blocked');
		const partial = plan({ ids: ['hosted-mcp'], target_infra: ['postgres'] }).text;
		expect(partial).toContain('key-value-store (from `rate-limiting`; unknown for the target — check)');
		expect(partial).not.toContain('Blocked');
	});

	it('conflicting exclusions are reported, never resolved silently', () => {
		const text = plan({ ids: ['hosted-mcp'], exclude: ['rate-limiting'] }).text;
		expect(section(text, 'Conflicts')).toContain('`rate-limiting` is excluded but `hosted-mcp` builds on it');
		expect(steps(text)).toEqual(['hosted-mcp']);
		const harmless = plan({ ids: ['layered-rag'], exclude: ['graph-rag'] }).text;
		expect(harmless).not.toContain('## Conflicts');
		expect(harmless).toContain('**Excluded by the caller** (nothing requires them): `graph-rag`');
	});

	it('a pin is preserved, and a conditional pin never prints as unconditional', () => {
		expect(plan({ ids: ['database-branch-refresh'] }).text).toMatch(/relational-db \(pinned to postgres/);
		for (const record of REGISTRY.patterns) {
			const text = plan({ ids: [record.id] }).text;
			for (const need of assemble(REGISTRY, {
				roots: new Map([[record.id, ['id']]]),
				conditions: new Map(),
				selected: new Set(),
				excluded: new Set(),
				target: { provides: null, lacks: new Set(), existing: new Set() },
			}).needs) {
				for (const pin of need.need.pins.filter((entry) => entry.conditional)) {
					expect(text, record.id).toContain(`pinned to ${pin.technology} only when`);
				}
			}
		}
	});
});

describe('semantics per kind and explainability', () => {
	it('a principle is applied, never a step; a workflow is performed', () => {
		const principle = REGISTRY.patterns.find((record) => record.kind === 'principle')?.id as string;
		const text = plan({ ids: [principle, 'hosted-mcp'] }).text;
		expect(steps(text)).not.toContain(principle);
		expect(section(text, 'Principles (constrain the work; never steps)')).toContain(`\`${principle}\` — requested`);
		const workflow = REGISTRY.patterns.find((record) => record.kind === 'workflow')?.id as string;
		expect(plan({ ids: [workflow] }).text).toMatch(new RegExp(`Perform \\(a workflow[^\\n]*\\(\`${workflow}\`\\)`));
	});

	it('every step says why it is there; specializations name their generalization', () => {
		const text = plan({ ids: ['agentic-parametric-modeling'] }).text;
		const blocks = text.split('\n### ').slice(1);
		for (const block of blocks) expect(block).toMatch(/\nWhy: .+\./);
		expect(text).toContain('Specializes `asset-production-engine`');
		expect(steps(text)).not.toContain('asset-production-engine');
	});

	it('compact by default within the token budget, full on request, never cut mid-step', () => {
		const ids = ['agentic-architecture', 'layered-rag', 'agentic-parametric-modeling', 'architecture-engineering'];
		const compact = plan({ ids }).text;
		const full = plan({ ids, detail: 'full' }).text;
		expect(compact.length).toBeLessThan(full.length);
		expect(compact.length / 4).toBeLessThan(10_000);
		expect(full.length / 4).toBeLessThan(10_000);
		expect(steps(compact)).toEqual(steps(full));
	});
});
