import { describe, expect, it } from 'vitest';
import { type ExpectedNeed, type FixtureRecord, NEED_RESOLUTION_CASES } from './infrastructure-needs.fixtures.ts';
import { type AdoptionNeed, adoptionNeeds } from './infrastructure-needs.ts';
import type { PatternRecord } from './schema.ts';

/** Every order of a record's prerequisites: the resolution must not depend on traversal order. */
function orders<T>(items: readonly T[]): T[][] {
	if (items.length <= 1) return [[...items]];
	return items.flatMap((item, index) =>
		orders([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]),
	);
}

function resolve(records: readonly FixtureRecord[], rootOrder: string[]): AdoptionNeed[] {
	const byId = new Map(
		records.map((record) => [
			record.id,
			{ ...record, depends_on: record.id === 'root' ? rootOrder : record.depends_on } as unknown as PatternRecord,
		]),
	);
	const root = byId.get('root');
	if (!root) throw new Error('fixture has no root');
	return adoptionNeeds(root, byId);
}

/** The current resolver's answer in the fixture's terms. Slice 3 replaces this projection. */
function observe(needs: readonly AdoptionNeed[], need: ExpectedNeed['need']): Required<Omit<ExpectedNeed, 'need'>> {
	const found = needs.find((entry) => entry.need === need);
	if (!found) return { level: 'absent', conditions: [], pins: [], origins: [], conflict: false };
	return {
		level: found.level,
		conditions: found.level === 'conditional' && found.when ? [found.when] : [],
		pins: found.pinned ? [found.pinned] : [],
		origins: [found.via ?? 'root'],
		conflict: false,
	};
}

describe('need resolution preserves constraints and provenance', () => {
	for (const fixture of NEED_RESOLUTION_CASES) {
		const root = fixture.records.find((record) => record.id === 'root');
		for (const order of orders(root?.depends_on ?? [])) {
			const name = `${fixture.name} (prerequisites ${order.join(', ') || 'none'})`;
			const check = () => {
				const needs = resolve(fixture.records, order);
				for (const expected of fixture.expected) {
					const actual = observe(needs, expected.need);
					expect(actual.level, `${expected.need} level`).toBe(expected.level);
					if (expected.conditions) expect(actual.conditions.sort()).toEqual(expected.conditions);
					if (expected.pins) expect(actual.pins.sort()).toEqual(expected.pins);
					if (expected.origins) expect(actual.origins.sort()).toEqual(expected.origins);
					if (expected.conflict !== undefined) expect(actual.conflict).toBe(expected.conflict);
				}
			};
			// A known gap is asserted to still fail: when Slice 3 fixes it, this flips and the
			// marker must be removed, so the fixture becomes a plain regression test.
			if (fixture.knownGap) it.fails(`${name} — known gap until Slice 3: ${fixture.knownGap}`, check);
			else it(name, check);
		}
	}
});
