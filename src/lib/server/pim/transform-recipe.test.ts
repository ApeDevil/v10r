import { describe, expect, it } from 'vitest';
import { ProductDataError } from './errors';
import { supplierRecipe, supplierRecipeJson, supplierSheet } from './fixtures/supplier-fixture';
import { applyRecipe, checkRecipe, parseTransformRecipe, type TransformRecipe } from './transform-recipe';

const COLUMNS = ['Artikelnr', 'EAN', 'Farbe'];

describe('checkRecipe — the column walk', () => {
	it('refuses a column the sheet does not have (the imagined column)', () => {
		const recipe: TransformRecipe = { ops: [{ op: 'trim', columns: ['Description'] }] };
		expect(checkRecipe(recipe, COLUMNS)).toEqual([
			{ opIndex: 0, message: '"Description" is not a column when trim runs.' },
		]);
	});

	it('refuses the old name after a rename, and accepts the new one', () => {
		const recipe: TransformRecipe = {
			ops: [
				{ op: 'rename', from: 'EAN', to: 'gtin' },
				{ op: 'normalize_gtin', column: 'EAN' },
				{ op: 'normalize_gtin', column: 'gtin' },
			],
		};
		expect(checkRecipe(recipe, COLUMNS).map((p) => p.opIndex)).toEqual([1]);
	});

	it('refuses an op that would overwrite an existing column', () => {
		const recipe: TransformRecipe = { ops: [{ op: 'rename', from: 'EAN', to: 'Farbe' }] };
		expect(checkRecipe(recipe, COLUMNS)[0].message).toMatch(/overwrite the existing column "Farbe"/);
	});

	it('parseTransformRecipe names the bad field of something that is not a recipe', () => {
		expect(() => parseTransformRecipe({ ops: [{ op: 'explode', column: 'EAN' }] }, COLUMNS)).toThrow(ProductDataError);
		expect(() => parseTransformRecipe({ ops: [] }, COLUMNS)).toThrow(/Not a recipe/);
	});
});

describe('applyRecipe on the worked example', () => {
	const sheet = supplierSheet();
	const run = applyRecipe(sheet, supplierRecipe());
	const row = (sku: string) => run.sheet.rows.find((r) => r.values.sku === sku)?.values;

	it('produces the target columns in a stable order', () => {
		expect(run.sheet.columns).toEqual([
			'sku',
			'gtin',
			'title',
			'color',
			'weight',
			'width_cm',
			'height_cm',
			'depth_cm',
			'brand',
		]);
	});

	it('repairs what it can read', () => {
		expect(row('A-1001')).toEqual({
			sku: 'A-1001',
			gtin: '0012345678905',
			title: 'Rucksack Urban 20L',
			color: 'Black',
			weight: '0.85 kg',
			width_cm: '30',
			height_cm: '45',
			depth_cm: '15',
			brand: 'Bergwerk',
		});
		expect(row('A-1004')?.weight).toBe('0.45 kg');
		expect(row('A-1007')?.color).toBe('White');
	});

	it('leaves what it cannot read exactly as it was, and lists it', () => {
		expect(row('A-1006')?.gtin).toBe('4.01235E+12');
		expect(row('A-1006')?.weight).toBe('ca. 2kg');
		const report = (op: string) => run.reports.find((r) => r.op === op);
		expect(report('normalize_gtin')?.unresolved).toEqual([{ line: 7, value: '4.01235E+12' }]);
		expect(report('convert_unit')?.unresolved).toEqual([{ line: 7, value: 'ca. 2kg' }]);
	});

	it('removes the duplicate row and names its source line', () => {
		expect(run.sheet.rows).toHaveLength(9);
		expect(run.reports.find((r) => r.op === 'dedupe')?.removedLines).toEqual([9]);
	});

	it('logs every changed cell with its source line and op', () => {
		expect(run.changes).toContainEqual({
			line: 2,
			column: 'gtin',
			before: '12345678905',
			after: '0012345678905',
			opIndex: 8,
		});
		expect(run.changes.every((c) => c.before !== c.after)).toBe(true);
	});

	it('does not touch its input and is deterministic', () => {
		expect(sheet.columns[0]).toBe('Artikelnr');
		expect(sheet.rows[0].values.EAN).toBe('12345678905');
		expect(applyRecipe(sheet, supplierRecipe())).toEqual(run);
	});

	it('refuses to run a recipe with problems — not even its valid prefix', () => {
		const broken = supplierRecipeJson() as TransformRecipe;
		broken.ops.push({ op: 'trim', columns: ['Bezeichnung'] });
		expect(() => applyRecipe(sheet, broken)).toThrow(/"Bezeichnung" is not a column/);
	});
});
