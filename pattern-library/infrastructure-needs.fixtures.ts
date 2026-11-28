/**
 * Need-resolution fixtures: what adopting a pattern must preserve when several records declare
 * the same infrastructure need. Each case states the target semantics (ApeDevil's Slice 1 review,
 * 2026-11-28); `infrastructure-needs.test.ts` runs them against the graph's resolver
 * (`pattern-graph.ts`) in every prerequisite order. Six cases were known gaps of the Slice 1
 * strictest-level-wins merge; the Slice 3 resolver meets all of them with the expectations
 * unchanged (the only edit is the relationship field: `depends_on` became `builds_on`).
 *
 * The model is deliberately small: per need, the strictest level, every distinct condition,
 * every pin, every originating record, and an explicit conflict when pins disagree. No general
 * constraint engine.
 */
import type { InfrastructureNeed, NeedEntry } from './schema.ts';

export interface FixtureRecord {
	id: string;
	builds_on: string[];
	needs: NeedEntry[];
}

/** What a resolver must report for one need of the root record. */
export interface ExpectedNeed {
	need: InfrastructureNeed;
	/** `absent` = the need must not appear at all. */
	level: 'required' | 'conditional' | 'optional' | 'implementation' | 'absent';
	/** Every distinct `when`, sorted. Empty when the level is not conditional. */
	conditions?: string[];
	/** Every distinct pinned technology, sorted. */
	pins?: string[];
	/** Every record the need comes from (`root` for the record's own declaration), sorted. */
	origins?: string[];
	/** True when the pins cannot all be satisfied by one binding. */
	conflict?: boolean;
}

export interface NeedResolutionCase {
	name: string;
	records: FixtureRecord[];
	expected: ExpectedNeed[];
}

const required = (need: InfrastructureNeed, pinned?: string): NeedEntry =>
	pinned ? { need, level: 'required', pinned, why: `the fixture pins ${pinned}` } : need;
const conditional = (need: InfrastructureNeed, when: string): NeedEntry => ({ need, level: 'conditional', when });

export const NEED_RESOLUTION_CASES: readonly NeedResolutionCase[] = [
	{
		name: 'an unrestricted requirement does not override a pinned one',
		records: [
			{ id: 'root', builds_on: ['a', 'b'], needs: [] },
			{ id: 'a', builds_on: [], needs: [required('relational-db')] },
			{ id: 'b', builds_on: [], needs: [required('relational-db', 'postgres')] },
		],
		expected: [{ need: 'relational-db', level: 'required', pins: ['postgres'], origins: ['a', 'b'], conflict: false }],
	},
	{
		name: 'two different conditions are both kept',
		records: [
			{ id: 'root', builds_on: ['a', 'b'], needs: [] },
			{ id: 'a', builds_on: [], needs: [conditional('key-value-store', 'quotas are shared across instances')] },
			{ id: 'b', builds_on: [], needs: [conditional('key-value-store', 'reports are cached across instances')] },
		],
		expected: [
			{
				need: 'key-value-store',
				level: 'conditional',
				conditions: ['quotas are shared across instances', 'reports are cached across instances'],
				origins: ['a', 'b'],
			},
		],
	},
	{
		name: 'incompatible pins are reported as a conflict',
		records: [
			{ id: 'root', builds_on: ['a', 'b'], needs: [] },
			{ id: 'a', builds_on: [], needs: [required('relational-db', 'postgres')] },
			{ id: 'b', builds_on: [], needs: [required('relational-db', 'mysql')] },
		],
		expected: [
			{ need: 'relational-db', level: 'required', pins: ['mysql', 'postgres'], origins: ['a', 'b'], conflict: true },
		],
	},
	{
		name: 'a requirement dominates a condition without losing the conditional origin',
		records: [
			{ id: 'root', builds_on: ['a', 'b'], needs: [] },
			{ id: 'a', builds_on: [], needs: [required('key-value-store')] },
			{ id: 'b', builds_on: [], needs: [conditional('key-value-store', 'quotas are shared across instances')] },
		],
		expected: [{ need: 'key-value-store', level: 'required', origins: ['a', 'b'] }],
	},
	{
		name: 'a need shared by two prerequisites appears once with both origins',
		records: [
			{ id: 'root', builds_on: ['a', 'b'], needs: [] },
			{ id: 'a', builds_on: [], needs: [required('relational-db')] },
			{ id: 'b', builds_on: [], needs: [required('relational-db')] },
		],
		expected: [{ need: 'relational-db', level: 'required', origins: ['a', 'b'] }],
	},
	{
		name: 'the record’s own declaration and an inherited one both count as origins',
		records: [
			{ id: 'root', builds_on: ['a'], needs: [conditional('relational-db', 'credentials are stored')] },
			{ id: 'a', builds_on: [], needs: [required('relational-db')] },
		],
		expected: [{ need: 'relational-db', level: 'required', origins: ['a', 'root'] }],
	},
	{
		name: 'optional and implementation needs never become requirements of a dependent',
		records: [
			{ id: 'root', builds_on: ['a'], needs: [] },
			{
				id: 'a',
				builds_on: [],
				needs: [
					{ need: 'graph-db', level: 'optional', why: 'the fixture’s optional tier' },
					{ need: 'llm-provider', level: 'implementation', why: 'the fixture’s own implementation' },
				],
			},
		],
		expected: [
			{ need: 'graph-db', level: 'absent' },
			{ need: 'llm-provider', level: 'absent' },
		],
	},
	{
		name: 'a diamond reaches the shared need once',
		records: [
			{ id: 'root', builds_on: ['a', 'b'], needs: [] },
			{ id: 'a', builds_on: ['c'], needs: [] },
			{ id: 'b', builds_on: ['c'], needs: [] },
			{ id: 'c', builds_on: [], needs: [required('scheduler')] },
		],
		expected: [{ need: 'scheduler', level: 'required', origins: ['c'] }],
	},
];
