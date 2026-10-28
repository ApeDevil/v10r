/**
 * A transform recipe: the reviewable, replayable description of how a product sheet becomes
 * the target's sheet — an ordered list of typed ops, each naming the columns it touches.
 *
 * This is the pattern's central split. An AI agent is good at reading a profile and deciding
 * *what* should happen ("Gewicht holds grams, the target wants kg"); it is bad at doing it to
 * forty thousand rows without dropping one. So the agent writes a recipe and never a cell:
 * `applyRecipe` runs the recipe deterministically over every row, and the same recipe on the
 * same sheet always yields the same output, change log and report. A person reviews twenty
 * lines of recipe instead of forty thousand rows, and next month's supplier file reuses it.
 *
 * Two rules keep that honest. A recipe that names a column which will not exist when its op
 * runs is refused whole by `checkRecipe` before any row is touched — the classic way a model's
 * plan goes wrong is a column it imagined. And an op never guesses: a value it cannot read
 * (`approx. 2kg`, a GTIN in scientific notation, a colour the mapping does not cover) is left
 * exactly as it was and listed in the op's report as unresolved, for a person or the next
 * recipe revision to decide.
 */
import * as v from 'valibot';
import { ProductDataError } from './errors';
import { normalizeGtin } from './gtin';
import { convertMeasure, formatMeasure, MEASURE_UNITS, type MeasureUnit, parseMeasure } from './measure';
import type { ProductRow, ProductSheet } from './product-sheet';

const columnName = v.pipe(v.string(), v.trim(), v.minLength(1));
const columnList = v.pipe(v.array(columnName), v.minLength(1));
const unit = v.picklist(MEASURE_UNITS);

export const recipeOpSchema = v.variant('op', [
	v.object({ op: v.literal('rename'), from: columnName, to: columnName }),
	v.object({ op: v.literal('drop'), columns: columnList }),
	v.object({ op: v.literal('trim'), columns: columnList }),
	v.object({
		op: v.literal('map_values'),
		column: columnName,
		/** Source value → target value; matched after trimming, ignoring case. */
		mapping: v.pipe(
			v.record(v.string(), v.string()),
			v.check((m) => Object.keys(m).length > 0, 'A mapping needs at least one entry.'),
		),
	}),
	v.object({
		op: v.literal('convert_unit'),
		column: columnName,
		to: unit,
		/** The unit a bare number is in; without it a bare number is unresolved. */
		assume: v.optional(unit),
	}),
	v.object({ op: v.literal('normalize_gtin'), column: columnName }),
	v.object({
		op: v.literal('split'),
		column: columnName,
		separator: v.pipe(v.string(), v.minLength(1)),
		/** New columns, in order; the last one takes whatever is left over. */
		into: v.pipe(v.array(columnName), v.minLength(2)),
	}),
	v.object({
		op: v.literal('concat'),
		columns: v.pipe(v.array(columnName), v.minLength(2)),
		separator: v.string(),
		into: columnName,
	}),
	v.object({ op: v.literal('fill_empty'), column: columnName, value: v.pipe(v.string(), v.minLength(1)) }),
	v.object({ op: v.literal('change_case'), column: columnName, mode: v.picklist(['upper', 'lower', 'title']) }),
	v.object({ op: v.literal('dedupe'), key: columnName, keep: v.picklist(['first', 'last']) }),
]);

export const transformRecipeSchema = v.object({
	/** Why this recipe exists, in a sentence — the reviewer reads it first. */
	note: v.optional(v.string()),
	ops: v.pipe(v.array(recipeOpSchema), v.minLength(1)),
});

export type RecipeOp = v.InferOutput<typeof recipeOpSchema>;
export type TransformRecipe = v.InferOutput<typeof transformRecipeSchema>;

export interface RecipeProblem {
	opIndex: number;
	message: string;
}

/** The columns an op reads, and the ones it creates or removes. */
function columnEffects(op: RecipeOp): { reads: string[]; creates: string[]; removes: string[] } {
	switch (op.op) {
		case 'rename':
			return { reads: [op.from], creates: [op.to], removes: [op.from] };
		case 'drop':
			return { reads: op.columns, creates: [], removes: op.columns };
		case 'trim':
			return { reads: op.columns, creates: [], removes: [] };
		case 'split':
			return { reads: [op.column], creates: op.into, removes: [] };
		case 'concat':
			return { reads: op.columns, creates: [op.into], removes: [] };
		case 'dedupe':
			return { reads: [op.key], creates: [], removes: [] };
		default:
			return { reads: [op.column], creates: [], removes: [] };
	}
}

/**
 * Every reason `recipe` cannot run on a sheet with `columns`, found by walking the column
 * set through the ops: a column read before it exists (or after it was renamed or dropped),
 * or created over one that is already there. Empty means the recipe will run.
 */
export function checkRecipe(recipe: TransformRecipe, columns: readonly string[]): RecipeProblem[] {
	const live = new Set(columns);
	const problems: RecipeProblem[] = [];
	recipe.ops.forEach((op, opIndex) => {
		if (op.op === 'rename' && op.from === op.to)
			problems.push({ opIndex, message: `rename maps "${op.from}" to itself.` });
		const { reads, creates, removes } = columnEffects(op);
		for (const column of reads) {
			if (!live.has(column)) problems.push({ opIndex, message: `"${column}" is not a column when ${op.op} runs.` });
		}
		for (const column of removes) live.delete(column);
		for (const column of creates) {
			if (live.has(column))
				problems.push({ opIndex, message: `${op.op} would overwrite the existing column "${column}".` });
			live.add(column);
		}
	});
	return problems;
}

/** Parse untrusted JSON (a file, a model's output) into a recipe that will run on `columns`. */
export function parseTransformRecipe(input: unknown, columns: readonly string[]): TransformRecipe {
	const parsed = v.safeParse(transformRecipeSchema, input);
	if (!parsed.success) {
		const issue = parsed.issues[0];
		const path = v.getDotPath(issue);
		throw new ProductDataError('invalid_recipe', `Not a recipe: ${path ? `${path}: ` : ''}${issue.message}`);
	}
	const problems = checkRecipe(parsed.output, columns);
	if (problems.length > 0) {
		const listed = problems.map((p) => `op ${p.opIndex + 1}: ${p.message}`).join(' ');
		throw new ProductDataError('invalid_recipe', `The recipe cannot run on this sheet. ${listed}`);
	}
	return parsed.output;
}

/** One line a reviewer can read without knowing the op vocabulary. */
export function describeOp(op: RecipeOp): string {
	switch (op.op) {
		case 'rename':
			return `Rename "${op.from}" to "${op.to}"`;
		case 'drop':
			return `Drop ${op.columns.map((c) => `"${c}"`).join(', ')}`;
		case 'trim':
			return `Trim whitespace in ${op.columns.map((c) => `"${c}"`).join(', ')}`;
		case 'map_values':
			return `Map ${Object.keys(op.mapping).length} values in "${op.column}"`;
		case 'convert_unit':
			return `Convert "${op.column}" to ${op.to}${op.assume ? ` (bare numbers are ${op.assume})` : ''}`;
		case 'normalize_gtin':
			return `Normalize GTINs in "${op.column}"`;
		case 'split':
			return `Split "${op.column}" on "${op.separator}" into ${op.into.map((c) => `"${c}"`).join(', ')}`;
		case 'concat':
			return `Join ${op.columns.map((c) => `"${c}"`).join(', ')} into "${op.into}"`;
		case 'fill_empty':
			return `Fill empty "${op.column}" with "${op.value}"`;
		case 'change_case':
			return `Make "${op.column}" ${op.mode} case`;
		case 'dedupe':
			return `Remove duplicate "${op.key}" rows, keeping the ${op.keep}`;
	}
}

/** A value an op could not handle; the cell was left exactly as it was. */
export interface UnresolvedValue {
	line: number;
	value: string;
}

export interface OpReport {
	opIndex: number;
	op: RecipeOp['op'];
	description: string;
	/** Cells whose text this op changed. */
	changed: number;
	/** At most `UNRESOLVED_LISTED` entries; `unresolvedCount` is the full count. */
	unresolved: UnresolvedValue[];
	unresolvedCount: number;
	/** `dedupe` only: source lines of the rows it removed. */
	removedLines: number[];
}

export interface CellChange {
	line: number;
	column: string;
	before: string;
	after: string;
	opIndex: number;
}

export interface RecipeRun {
	sheet: ProductSheet;
	reports: OpReport[];
	/** Every cell the recipe changed, in op order — the audit trail a reviewer filters. */
	changes: CellChange[];
}

const UNRESOLVED_LISTED = 50;

function insertAfter(columns: string[], anchor: string, added: string[]): string[] {
	const at = columns.indexOf(anchor) + 1;
	return [...columns.slice(0, at), ...added, ...columns.slice(at)];
}

function titleCase(text: string): string {
	return text
		.toLowerCase()
		.replace(/(^|[\s\-/])(\p{L})/gu, (_, gap: string, letter: string) => gap + letter.toUpperCase());
}

/**
 * Run `recipe` over every row of `sheet`. The input is not modified. Throws
 * `ProductDataError('invalid_recipe')` if the recipe cannot run on this sheet — it never
 * runs part of a recipe.
 */
export function applyRecipe(sheet: ProductSheet, recipe: TransformRecipe): RecipeRun {
	const problems = checkRecipe(recipe, sheet.columns);
	if (problems.length > 0) {
		throw new ProductDataError('invalid_recipe', problems.map((p) => `op ${p.opIndex + 1}: ${p.message}`).join(' '));
	}

	let columns = [...sheet.columns];
	let rows: ProductRow[] = sheet.rows.map((r) => ({ line: r.line, values: { ...r.values } }));
	const changes: CellChange[] = [];
	const reports: OpReport[] = [];

	recipe.ops.forEach((op, opIndex) => {
		const report: OpReport = {
			opIndex,
			op: op.op,
			description: describeOp(op),
			changed: 0,
			unresolved: [],
			unresolvedCount: 0,
			removedLines: [],
		};
		const set = (row: ProductRow, column: string, after: string) => {
			const before = row.values[column] ?? '';
			row.values[column] = after;
			if (before === after) return;
			report.changed++;
			changes.push({ line: row.line, column, before, after, opIndex });
		};
		const unresolved = (row: ProductRow, value: string) => {
			report.unresolvedCount++;
			if (report.unresolved.length < UNRESOLVED_LISTED) report.unresolved.push({ line: row.line, value });
		};
		/** Apply `fn` to every non-empty cell of `column`; null leaves the cell and reports it. */
		const eachValue = (column: string, fn: (value: string) => string | null) => {
			for (const row of rows) {
				const value = row.values[column];
				if (value.trim() === '') continue;
				const after = fn(value);
				if (after === null) unresolved(row, value);
				else set(row, column, after);
			}
		};

		switch (op.op) {
			case 'rename':
				columns = columns.map((c) => (c === op.from ? op.to : c));
				for (const row of rows) {
					row.values[op.to] = row.values[op.from];
					delete row.values[op.from];
				}
				break;
			case 'drop':
				columns = columns.filter((c) => !op.columns.includes(c));
				for (const row of rows) for (const c of op.columns) delete row.values[c];
				break;
			case 'trim':
				for (const column of op.columns) eachValue(column, (value) => value.trim().replace(/\s+/g, ' '));
				break;
			case 'map_values': {
				const lookup = new Map(Object.entries(op.mapping).map(([from, to]) => [from.trim().toLowerCase(), to]));
				eachValue(op.column, (value) => lookup.get(value.trim().toLowerCase()) ?? null);
				break;
			}
			case 'convert_unit':
				eachValue(op.column, (value) => {
					const measure = parseMeasure(value);
					const from: MeasureUnit | undefined = measure?.unit ?? op.assume;
					if (!measure || !from) return null;
					const amount = convertMeasure(measure.amount, from, op.to);
					return amount === null ? null : formatMeasure(amount, op.to);
				});
				break;
			case 'normalize_gtin':
				eachValue(op.column, normalizeGtin);
				break;
			case 'split':
				columns = insertAfter(columns, op.column, op.into);
				for (const row of rows) {
					const parts = row.values[op.column].split(op.separator);
					const last = op.into.length - 1;
					op.into.forEach((target, i) => {
						const part = i < last ? parts[i] : parts.slice(last).join(op.separator);
						row.values[target] = '';
						set(row, target, (part ?? '').trim());
					});
				}
				break;
			case 'concat':
				columns = insertAfter(columns, op.columns[op.columns.length - 1], [op.into]);
				for (const row of rows) {
					row.values[op.into] = '';
					const parts = op.columns.map((c) => row.values[c].trim()).filter((p) => p !== '');
					set(row, op.into, parts.join(op.separator));
				}
				break;
			case 'fill_empty':
				for (const row of rows) if (row.values[op.column].trim() === '') set(row, op.column, op.value);
				break;
			case 'change_case':
				eachValue(op.column, (value) =>
					op.mode === 'upper' ? value.toUpperCase() : op.mode === 'lower' ? value.toLowerCase() : titleCase(value),
				);
				break;
			case 'dedupe': {
				const keptIndexOfKey = new Map<string, number>();
				rows.forEach((row, index) => {
					const key = row.values[op.key].trim();
					if (key === '') return;
					if (!keptIndexOfKey.has(key) || op.keep === 'last') keptIndexOfKey.set(key, index);
				});
				const kept = new Set(keptIndexOfKey.values());
				rows = rows.filter((row, index) => {
					if (row.values[op.key].trim() === '' || kept.has(index)) return true;
					report.removedLines.push(row.line);
					return false;
				});
				break;
			}
		}
		reports.push(report);
	});

	return { sheet: { columns, rows }, reports, changes };
}
