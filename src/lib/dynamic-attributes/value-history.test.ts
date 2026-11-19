import { describe, expect, it } from 'vitest';
import { type AttributeRecord, coreAttributeKinds, valueHistory } from './index.ts';

const at = (value: number | null, label = 'Width', revision = 1): AttributeRecord => ({
	format: 1,
	removed: [],
	attributes:
		value === null
			? []
			: [
					{
						id: 'att_0000000001',
						label,
						kind: 'number',
						value,
						config: {},
						binding: { definition: 'def_0000000001', revision },
					},
				],
});

describe('valueHistory', () => {
	it('lists changes, not saves, and follows the definition across relabels and removal', () => {
		const versions = [at(6.5), at(6.5), at(7), at(70, 'Breadth', 2), at(null), at(70)].map((record, i) => ({
			version: i,
			savedAt: `2026-11-19T10:0${i}:00Z`,
			record,
		}));
		expect(
			valueHistory(versions, 'def_0000000001', coreAttributeKinds).map((e) => [
				e.version,
				e.text,
				e.label,
				e.absent ?? false,
			]),
		).toEqual([
			[0, '6.5', 'Width', false],
			[2, '7', 'Width', false],
			[3, '70', 'Breadth', false],
			[4, '', 'Breadth', true],
			[5, '70', 'Width', false],
		]);
	});
});
