/**
 * A target schema: the attributes a destination — a shop, a marketplace feed, the PIM's own
 * import — accepts, and the rules each value must meet. It is the "done" a transformation
 * is measured against: a recipe is good when `checkSheet` reports no issue, not when the
 * model that wrote it says so.
 *
 * Checking is deterministic and exhaustive: every row, every attribute, every issue named
 * with its source line. Nothing here is sampled; sampling is the profile's job.
 */
import * as v from 'valibot';
import { isValidGtin } from './gtin';
import { MEASURE_UNITS, parseMeasure } from './measure';
import type { ProductSheet } from './product-sheet';

export const ATTRIBUTE_KINDS = ['text', 'integer', 'decimal', 'gtin', 'enum', 'measure'] as const;

const targetAttributeSchema = v.object({
	name: v.pipe(v.string(), v.trim(), v.minLength(1)),
	kind: v.picklist(ATTRIBUTE_KINDS),
	required: v.optional(v.boolean(), false),
	/** `enum` only: the accepted values, exactly as the target spells them. */
	values: v.optional(v.array(v.string())),
	/** `measure` only: the one unit the target accepts. */
	unit: v.optional(v.picklist(MEASURE_UNITS)),
	maxLength: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
});

export const targetSchemaSchema = v.pipe(
	v.object({
		/** The column that identifies a product; duplicates of it are issues. */
		key: v.pipe(v.string(), v.trim(), v.minLength(1)),
		attributes: v.pipe(v.array(targetAttributeSchema), v.minLength(1)),
	}),
	v.check((s) => s.attributes.some((a) => a.name === s.key), 'The key must be one of the attributes.'),
	v.check(
		(s) => s.attributes.every((a) => (a.kind === 'enum') === (a.values !== undefined && a.values.length > 0)),
		'An enum attribute needs values, and only an enum attribute may have them.',
	),
	v.check(
		(s) => s.attributes.every((a) => (a.kind === 'measure') === (a.unit !== undefined)),
		'A measure attribute needs a unit, and only a measure attribute may have one.',
	),
);

export type TargetSchema = v.InferOutput<typeof targetSchemaSchema>;
export type TargetAttribute = TargetSchema['attributes'][number];

export type SheetIssueRule = 'required' | 'kind' | 'enum' | 'unit' | 'max_length' | 'duplicate_key';

export interface SheetIssue {
	line: number;
	column: string;
	rule: SheetIssueRule;
	value: string;
}

export interface SheetCheck {
	/** Target attributes the sheet has no column for — every row fails them. */
	missingColumns: string[];
	/** Sheet columns the target does not accept; reported, not an issue per row. */
	extraColumns: string[];
	issues: SheetIssue[];
	/** Rows with at least one issue (or all rows, when a required column is missing). */
	rowsWithIssues: number;
}

function ruleBroken(attribute: TargetAttribute, value: string): SheetIssueRule | null {
	if (value === '') return attribute.required ? 'required' : null;
	if (attribute.maxLength !== undefined && value.length > attribute.maxLength) return 'max_length';
	switch (attribute.kind) {
		case 'text':
			return null;
		case 'integer':
			return /^-?\d+$/.test(value) ? null : 'kind';
		case 'decimal':
			return /^-?\d+(\.\d+)?$/.test(value) ? null : 'kind';
		case 'gtin':
			return isValidGtin(value) ? null : 'kind';
		case 'enum':
			return attribute.values?.includes(value) ? null : 'enum';
		case 'measure': {
			const measure = parseMeasure(value);
			if (!measure || !/^-?\d+(\.\d+)? [a-z]+$/.test(value)) return 'kind';
			return measure.unit === attribute.unit ? null : 'unit';
		}
	}
}

/** Every rule the sheet breaks against `target`, row by row. */
export function checkSheet(sheet: ProductSheet, target: TargetSchema): SheetCheck {
	const present = new Set(sheet.columns);
	const accepted = new Set(target.attributes.map((a) => a.name));
	const missingColumns = target.attributes.filter((a) => !present.has(a.name)).map((a) => a.name);
	const extraColumns = sheet.columns.filter((c) => !accepted.has(c));
	const checked = target.attributes.filter((a) => present.has(a.name));

	const issues: SheetIssue[] = [];
	const failing = new Set<number>();
	const firstLineOfKey = new Map<string, number>();
	for (const row of sheet.rows) {
		for (const attribute of checked) {
			const value = row.values[attribute.name];
			const rule = ruleBroken(attribute, value);
			if (rule) {
				issues.push({ line: row.line, column: attribute.name, rule, value });
				failing.add(row.line);
			}
		}
		const key = row.values[target.key];
		if (key !== undefined && key !== '') {
			if (firstLineOfKey.has(key)) {
				issues.push({ line: row.line, column: target.key, rule: 'duplicate_key', value: key });
				failing.add(row.line);
			} else firstLineOfKey.set(key, row.line);
		}
	}

	const missingRequired = target.attributes.some((a) => a.required && missingColumns.includes(a.name));
	return {
		missingColumns,
		extraColumns,
		issues,
		rowsWithIssues: missingRequired ? sheet.rows.length : failing.size,
	};
}

/** Issues grouped by column and rule — bounded however many rows fail, for a prompt or a summary line. */
export interface IssueGroup {
	column: string;
	rule: SheetIssueRule;
	count: number;
	/** Up to five distinct failing values, clipped. */
	examples: string[];
}

export function groupIssues(check: SheetCheck): IssueGroup[] {
	const groups = new Map<string, IssueGroup>();
	for (const issue of check.issues) {
		const id = `${issue.column}\u0000${issue.rule}`;
		const group = groups.get(id) ?? { column: issue.column, rule: issue.rule, count: 0, examples: [] };
		group.count++;
		const example = issue.value.length > 60 ? `${issue.value.slice(0, 59)}…` : issue.value;
		if (group.examples.length < 5 && !group.examples.includes(example)) group.examples.push(example);
		groups.set(id, group);
	}
	return [...groups.values()].sort((a, b) => b.count - a.count);
}
