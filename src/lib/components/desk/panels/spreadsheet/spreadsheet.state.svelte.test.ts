import { describe, expect, it } from 'vitest';
import { createSpreadsheetState } from './spreadsheet.state.svelte';

/** Type a value into a cell the way the grid does: select, edit, commit. */
function type(sheet: ReturnType<typeof createSpreadsheetState>, label: string, raw: string) {
	const col = label.charCodeAt(0) - 65;
	const row = Number(label.slice(1)) - 1;
	sheet.select(col, row);
	sheet.startEditing();
	sheet.editValue = raw;
	sheet.commitEdit();
}

/** Displayed contents of the named cells: the error when there is one, else the value. */
function shown(sheet: ReturnType<typeof createSpreadsheetState>, ...labels: string[]) {
	return labels.map((label) => {
		const cell = sheet.getCell(label.charCodeAt(0) - 65, Number(label.slice(1)) - 1);
		return cell ? (cell.error ?? cell.value) : null;
	});
}

describe('dependency evaluation', () => {
	it('resolves a chain entered in reverse dependency order', () => {
		const sheet = createSpreadsheetState();
		type(sheet, 'A1', '=B1');
		type(sheet, 'B1', '=C1');
		type(sheet, 'C1', '1');
		expect(shown(sheet, 'A1', 'B1', 'C1')).toEqual([1, 1, 1]);
	});

	it('propagates an edit through a long reverse-ordered chain in one pass', () => {
		const sheet = createSpreadsheetState();
		type(sheet, 'A1', '=B1');
		type(sheet, 'B1', '=C1');
		type(sheet, 'C1', '=D1');
		type(sheet, 'D1', '=E1');
		type(sheet, 'E1', '2');
		expect(shown(sheet, 'A1', 'B1', 'C1', 'D1')).toEqual([2, 2, 2, 2]);

		type(sheet, 'E1', '7');
		expect(shown(sheet, 'A1', 'B1', 'C1', 'D1')).toEqual([7, 7, 7, 7]);
	});

	it('reports a direct self-reference', () => {
		const sheet = createSpreadsheetState();
		type(sheet, 'A1', '=A1');
		expect(shown(sheet, 'A1')).toEqual(['#CIRC!']);
	});

	it('reports every cell of an indirect cycle', () => {
		const sheet = createSpreadsheetState();
		type(sheet, 'A1', '=B1');
		type(sheet, 'B1', '=A1');
		expect(shown(sheet, 'A1', 'B1')).toEqual(['#CIRC!', '#CIRC!']);
	});

	it('does not sum around a cycle that runs through a range', () => {
		const sheet = createSpreadsheetState();
		type(sheet, 'A1', '=SUM(B1:B2)');
		type(sheet, 'B1', '=A1');
		type(sheet, 'B2', '5');
		// Reporting 5 here would be a plausible number for a sheet that has no answer.
		expect(shown(sheet, 'A1', 'B1')).toEqual(['#CIRC!', '#CIRC!']);
	});

	it('recovers once the cycle is broken', () => {
		const sheet = createSpreadsheetState();
		type(sheet, 'A1', '=B1');
		type(sheet, 'B1', '=A1');
		type(sheet, 'B1', '3');
		expect(shown(sheet, 'A1', 'B1')).toEqual([3, 3]);
	});

	it('falls back to empty when a dependency is deleted', () => {
		const sheet = createSpreadsheetState();
		type(sheet, 'A1', '=SUM(B1:B2)');
		type(sheet, 'B1', '4');
		expect(shown(sheet, 'A1')).toEqual([4]);
		type(sheet, 'B1', '');
		expect(shown(sheet, 'A1')).toEqual([0]);
	});

	it('treats text beginning with a hash as data, not an error', () => {
		const sheet = createSpreadsheetState();
		type(sheet, 'A1', '#1 pick');
		expect(sheet.getCell(0, 0)).toMatchObject({ value: '#1 pick', error: null });
	});
});

describe('persisted formulas', () => {
	it('resolves a stored sheet whose formulas precede their inputs', () => {
		const sheet = createSpreadsheetState();
		sheet.fromJSON({
			A1: { v: null, f: '=B1' },
			B1: { v: null, f: '=C1' },
			C1: { v: 6 },
		});
		expect(shown(sheet, 'A1', 'B1', 'C1')).toEqual([6, 6, 6]);
	});

	it('recomputes stored values rather than trusting them', () => {
		const sheet = createSpreadsheetState();
		// A stale `v` from a writer that saved before its input changed.
		sheet.fromJSON({ A1: { v: 99, f: '=B1' }, B1: { v: 1 } });
		expect(shown(sheet, 'A1')).toEqual([1]);
	});

	it('persists resolved values so other readers see them', () => {
		const sheet = createSpreadsheetState();
		type(sheet, 'A1', '=B1');
		type(sheet, 'B1', '8');
		expect(sheet.toJSON()).toEqual({ A1: { v: 8, f: '=B1' }, B1: { v: 8 } });
	});

	it('serializes resolved values into AI context', () => {
		const sheet = createSpreadsheetState();
		type(sheet, 'A1', '=B1');
		type(sheet, 'B1', '9');
		sheet.select(0, 0);
		sheet.select(1, 0, true);
		const { content } = sheet.serializeContext('Sheet1');
		expect(content).toContain('| 1 | 9 | 9 |');
		expect(content).toContain('A1==B1 → 9');
	});
});
