import { describe, expect, it } from 'vitest';
import { type ExpectedNeed, type FixtureRecord, NEED_RESOLUTION_CASES } from './infrastructure-needs.fixtures.ts';
import { patternGraph, type ResolvedNeed } from './pattern-graph.ts';
import type { PatternRecord, Registry } from './schema.ts';

/** Every order of a record's prerequisites: the resolution must not depend on traversal order. */
function orders<T>(items: readonly T[]): T[][] {
	if (items.length <= 1) return [[...items]];
	return items.flatMap((item, index) =>
		orders([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]),
	);
}

function resolve(records: readonly FixtureRecord[], rootOrder: string[]): ResolvedNeed[] {
	const patterns = records.map(
		(record) =>
			({
				id: record.id,
				kind: 'pattern',
				needs: record.needs,
				builds_on: (record.id === 'root' ? rootOrder : record.builds_on).map((id) => ({ id, why: 'fixture' })),
				composes: [],
				specializes: null,
				references: [],
				invariants: [],
				code: [],
			}) as unknown as PatternRecord,
	);
	return patternGraph({ assumptions: [], patterns } as unknown as Registry).needs('root');
}

/** The resolver's answer in the fixture's terms. */
function observe(needs: readonly ResolvedNeed[], need: ExpectedNeed['need']): Required<Omit<ExpectedNeed, 'need'>> {
	const found = needs.find((entry) => entry.need === need);
	if (!found) return { level: 'absent', conditions: [], pins: [], origins: [], conflict: false };
	return {
		level: found.level,
		conditions: [...found.conditions],
		pins: found.pins.map((pin) => pin.technology),
		origins: [...found.origins],
		conflict: found.conflict?.certain ?? false,
	};
}

describe('need resolution preserves constraints and provenance', () => {
	for (const fixture of NEED_RESOLUTION_CASES) {
		const root = fixture.records.find((record) => record.id === 'root');
		for (const order of orders(root?.builds_on ?? [])) {
			it(`${fixture.name} (prerequisites ${order.join(', ') || 'none'})`, () => {
				const needs = resolve(fixture.records, order);
				for (const expected of fixture.expected) {
					const actual = observe(needs, expected.need);
					expect(actual.level, `${expected.need} level`).toBe(expected.level);
					if (expected.conditions) expect(actual.conditions.sort()).toEqual(expected.conditions);
					if (expected.pins) expect(actual.pins.sort()).toEqual(expected.pins);
					if (expected.origins) expect(actual.origins.sort()).toEqual(expected.origins);
					if (expected.conflict !== undefined) expect(actual.conflict).toBe(expected.conflict);
				}
			});
		}
	}
});
