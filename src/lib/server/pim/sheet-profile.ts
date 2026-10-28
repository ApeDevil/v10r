/**
 * A sheet profile: what an AI agent reads instead of the sheet.
 *
 * Its size is bounded by the number of columns, never by the number of rows — per column a
 * fill count, a distinct count, the commonest values and the shape most values have, plus a
 * handful of sample rows, every value clipped. A forty-thousand-row export and a forty-row
 * one produce prompts of the same size, which is what makes the agent's cost and context
 * predictable and keeps the bulk of the data out of the model entirely.
 *
 * The profile is evidence for a decision, not the decision: the agent proposes a recipe from
 * it, and `checkSheet` over the full output is what says whether the recipe worked.
 */
import { normalizeGtin } from './gtin';
import { parseMeasure } from './measure';
import type { ProductSheet } from './product-sheet';

/** The form most of a column's values take; `mixed` when no form covers 90% of them. */
export type ValueShape = 'empty' | 'gtin' | 'integer' | 'decimal' | 'measure' | 'text' | 'mixed';

export interface ColumnProfile {
	name: string;
	filled: number;
	empty: number;
	distinct: number;
	shape: ValueShape;
	/** The commonest values, most frequent first, clipped to `PROFILE_VALUE_LENGTH`. */
	topValues: { value: string; count: number }[];
	maxLength: number;
}

export interface SheetProfile {
	rows: number;
	columns: ColumnProfile[];
	/** Rows as stored, clipped, for the agent to see real values in context. */
	sample: { line: number; values: Record<string, string> }[];
}

export interface ProfileOptions {
	sampleRows?: number;
	topValues?: number;
}

export const PROFILE_VALUE_LENGTH = 80;
const SHAPE_SHARE = 0.9;

function clip(value: string): string {
	return value.length > PROFILE_VALUE_LENGTH ? `${value.slice(0, PROFILE_VALUE_LENGTH - 1)}…` : value;
}

function shapeOf(value: string): Exclude<ValueShape, 'empty' | 'mixed'> {
	const text = value.trim();
	if (/^-?\d+$/.test(text)) return text.length >= 8 && normalizeGtin(text) ? 'gtin' : 'integer';
	if (/^-?\d+[.,]\d+$/.test(text)) return 'decimal';
	if (parseMeasure(text)) return 'measure';
	return 'text';
}

function profileColumn(sheet: ProductSheet, name: string, topValues: number): ColumnProfile {
	const counts = new Map<string, number>();
	const shapes = new Map<ValueShape, number>();
	let filled = 0;
	let maxLength = 0;
	for (const row of sheet.rows) {
		const value = row.values[name];
		if (value.trim() === '') continue;
		filled++;
		maxLength = Math.max(maxLength, value.length);
		counts.set(value, (counts.get(value) ?? 0) + 1);
		const shape = shapeOf(value);
		shapes.set(shape, (shapes.get(shape) ?? 0) + 1);
	}

	let shape: ValueShape = filled === 0 ? 'empty' : 'mixed';
	for (const [candidate, count] of shapes) if (count >= filled * SHAPE_SHARE) shape = candidate;

	return {
		name,
		filled,
		empty: sheet.rows.length - filled,
		distinct: counts.size,
		shape,
		topValues: [...counts]
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.slice(0, topValues)
			.map(([value, count]) => ({ value: clip(value), count })),
		maxLength,
	};
}

/** Profile every column of `sheet`; deterministic for a given sheet and options. */
export function profileSheet(sheet: ProductSheet, options: ProfileOptions = {}): SheetProfile {
	const { sampleRows = 5, topValues = 8 } = options;
	return {
		rows: sheet.rows.length,
		columns: sheet.columns.map((name) => profileColumn(sheet, name, topValues)),
		sample: sheet.rows.slice(0, sampleRows).map((row) => ({
			line: row.line,
			values: Object.fromEntries(sheet.columns.map((c) => [c, clip(row.values[c])])),
		})),
	};
}
