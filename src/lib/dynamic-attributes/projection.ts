/**
 * Projections: how one consumer sees records. A record says what a thing *has*; the dictionary
 * says what each attribute *is*; a projection says how a webshop, a marketplace feed or a
 * printed datasheet wants it — which attributes, under which names, nested how, in which unit,
 * rendered how. Many projections read the same records; none of them changes the records.
 *
 * A projection is data, never code: its value steps are a closed set of typed operations (the
 * same vocabulary as the PIM transform recipe), and its render hints are a closed vocabulary a
 * renderer may honour or ignore. Unknown steps or hints are refused when the projection is parsed.
 *
 * A projection is **pinned** to a dictionary revision. It reads labels, kinds and units as that
 * revision states them, so a rename or a unit change in the dictionary cannot silently change a
 * consumer's output; `checkProjectionImpact` says what moving the pin would change, and the
 * consumer's owner moves it when ready.
 */
import * as v from 'valibot';
import { convertMeasure, MEASURE_UNITS, type MeasureUnit } from '#lib/utils/measure.ts';
import { isLabel } from './codec.ts';
import {
	type AttributeDefinition,
	type AttributeDictionary,
	definitionAt,
	definitionLabel,
	dictionaryAt,
	isLocaleTag,
	latestRevision,
} from './dictionary.ts';
import { canonicalJson, copyBoundedJson, type JsonObject, type JsonValue, jsonEqual } from './json.ts';
import type { AttributeKindRegistry, SelectOption } from './kinds.ts';
import { type AttributeLimits, DEFAULT_ATTRIBUTE_LIMITS } from './limits.ts';
import { type AttributeRecord, isDefinitionId } from './record.ts';

/** A record as plain text — one `label: value` line per attribute, in order. The projection every record has. */
export function attributeRecordToText(record: AttributeRecord, kinds: AttributeKindRegistry): string {
	return record.attributes
		.map((attribute) => {
			const kind = kinds.get(attribute.kind);
			const label = attribute.label.trim() || '(unlabelled)';
			if (!kind) return `${label}: (value of unknown kind "${attribute.kind}")`;
			return textLine(label, kind.text(attribute.value, attribute.config));
		})
		.join('\n');
}

function textLine(label: string, text: string): string {
	return `${label}: ${text.includes('\n') ? `\n  ${text.split('\n').join('\n  ')}` : text}`;
}

// ── The projection document ───────────────────────────────────────────────────────────────

export const ATTRIBUTE_PROJECTION_FORMAT = 1;

/** What shape a consumer receives: a nested JSON object, one flat row (CSV, Excel), or text lines. */
export type ProjectionOutput = 'object' | 'row' | 'text';
export const PROJECTION_OUTPUTS: readonly ProjectionOutput[] = ['object', 'row', 'text'];

/** One typed step on a projected value. Closed set; applied in order. */
export type ProjectionStep =
	| { op: 'convert_unit'; to: MeasureUnit }
	| { op: 'round'; decimals: number }
	| { op: 'map_options'; map: Record<string, string> }
	| { op: 'change_case'; mode: 'upper' | 'lower' }
	| { op: 'join'; separator: string }
	| { op: 'with_unit' };

/** How a consumer would like a field shown. Hints only: a renderer may ignore any of them. */
export interface RenderHints {
	/** A heading the field is shown under; fields with one group sit together. */
	group?: string;
	display?: 'text' | 'heading' | 'badge' | 'list';
	emphasis?: 'strong' | 'muted';
}

export const RENDER_DISPLAYS: readonly NonNullable<RenderHints['display']>[] = ['text', 'heading', 'badge', 'list'];

export interface ProjectionField {
	/** The attribute definition this field reads. */
	from: string;
	/** Where the value lands: a dot path (`specs.width_mm`) for objects, the column name for rows. */
	as: string;
	/** The consumer's own label, overriding the dictionary's. */
	label?: string;
	steps?: ProjectionStep[];
	render?: RenderHints;
}

export interface AttributeProjection {
	format: typeof ATTRIBUTE_PROJECTION_FORMAT;
	/** Lowercase slug naming the consumer: `webshop`, `marketplace-feed`. */
	consumer: string;
	/** The consumer's display name. */
	name: string;
	locale: string;
	/** The dictionary revision this consumer reads labels, kinds and units from. */
	dictionaryRevision: number;
	output: ProjectionOutput;
	fields: ProjectionField[];
}

// ── Projecting ────────────────────────────────────────────────────────────────────────────

export type ProjectionFindingCode =
	| 'unknown_revision'
	| 'unknown_definition'
	| 'retired_definition'
	| 'no_value'
	| 'not_converted'
	| 'step_skipped';

export interface ProjectionFinding {
	code: ProjectionFindingCode;
	/** The field's `as`, or empty for the projection as a whole. */
	field: string;
	/** The step that could not apply, for `step_skipped`. */
	step?: ProjectionStep['op'];
}

export interface ProjectedField {
	from: string;
	as: string;
	label: string;
	/** The value after every step; null when the record has none. */
	value: JsonValue;
	/** The value as a reader sees it. */
	text: string;
	render: RenderHints;
	/** The unit `value` is in, when it is a measured number. */
	unit?: MeasureUnit;
}

export interface Projection {
	fields: ProjectedField[];
	/** What the consumer receives: nested for `object`, flat for `row` and `text`. */
	document: JsonObject;
	/** The fields as `label: text` lines. */
	text: string;
	findings: ProjectionFinding[];
}

/** A value on its way through the steps: its JSON, its text, and its unit when it measures something. */
interface Cell {
	value: JsonValue;
	text: string;
	unit?: MeasureUnit;
	/** The option id, for a choice — what `map_options` keys on. */
	option?: string | null;
}

/**
 * Project one record for one consumer. Never throws and never refuses: a field that cannot be
 * filled becomes `null` with a finding, because a consumer missing one value is a report, not
 * a reason to send nothing.
 */
export function projectRecord(
	record: AttributeRecord,
	dictionary: AttributeDictionary,
	projection: AttributeProjection,
	kinds: AttributeKindRegistry,
	limits: AttributeLimits = DEFAULT_ATTRIBUTE_LIMITS,
): Projection {
	const findings: ProjectionFinding[] = [];
	const pinned = dictionaryAt(dictionary, projection.dictionaryRevision);
	if (!pinned) {
		return { fields: [], document: {}, text: '', findings: [{ code: 'unknown_revision', field: '' }] };
	}
	const byDefinition = new Map(record.attributes.flatMap((a) => (a.binding ? [[a.binding.definition, a]] : [])));
	const fields: ProjectedField[] = [];

	for (const field of projection.fields) {
		const definition = pinned.definitions.find((d) => d.id === field.from);
		if (!definition) {
			findings.push({ code: 'unknown_definition', field: field.as });
			continue;
		}
		if (definition.status === 'retired') findings.push({ code: 'retired_definition', field: field.as });
		const label = field.label ?? definitionLabel(definition, projection.locale, dictionary.sourceLocale);
		const render = field.render ?? {};
		const attribute = byDefinition.get(field.from);
		const cell = attribute
			? readCell(attribute, definition, dictionary, kinds, limits, () =>
					findings.push({ code: 'not_converted', field: field.as }),
				)
			: null;
		if (!cell) {
			if (!attribute) findings.push({ code: 'no_value', field: field.as });
			fields.push({ from: field.from, as: field.as, label, value: null, text: '', render });
			continue;
		}
		let current = cell;
		for (const step of field.steps ?? []) {
			const next = applyStep(current, step);
			if (next) current = next;
			else findings.push({ code: 'step_skipped', field: field.as, step: step.op });
		}
		const projected: ProjectedField = {
			from: field.from,
			as: field.as,
			label,
			value: current.value,
			text: current.text,
			render,
		};
		if (current.unit && typeof current.value === 'number') projected.unit = current.unit;
		fields.push(projected);
	}

	const document: JsonObject = {};
	for (const field of fields) {
		if (projection.output === 'object') setPath(document, field.as, field.value);
		else document[field.as] = field.text;
	}
	const text = fields.map((f) => textLine(f.label, f.text)).join('\n');
	return { fields, document, text, findings };
}

/**
 * The attribute's value as the pinned definition states it. The record holds the value as its
 * own binding revision defined it; when the pin is on another revision, the unit and kind are
 * converted to the pinned ones (180 mm reads as 18 cm for a consumer still pinned to cm).
 */
function readCell(
	attribute: AttributeRecord['attributes'][number],
	pinned: AttributeDefinition,
	dictionary: AttributeDictionary,
	kinds: AttributeKindRegistry,
	limits: AttributeLimits,
	notConverted: () => void,
): Cell | null {
	const fromKind = kinds.get(attribute.kind);
	const toKind = kinds.get(pinned.kind);
	if (!fromKind || !toKind) {
		notConverted();
		return null;
	}
	const written = attribute.binding
		? definitionAt(dictionary, attribute.binding.definition, attribute.binding.revision)
		: undefined;
	let value = attribute.value;
	if (attribute.kind !== pinned.kind) {
		const converted = toKind.fromText(fromKind.text(value, attribute.config), pinned.config, limits);
		if (converted === undefined || !toKind.accepts(converted, pinned.config, limits)) {
			notConverted();
			return null;
		}
		value = converted;
	} else if (written?.unit && pinned.unit && written.unit !== pinned.unit && typeof value === 'number') {
		const converted = convertMeasure(value, written.unit, pinned.unit);
		if (converted === null) {
			notConverted();
			return null;
		}
		value = Number(converted.toFixed(6));
	}
	const text = toKind.text(value, pinned.config);
	// A choice leaves the source as its option label: option ids are the source's own identity.
	if (pinned.kind === 'select') return { value: value === null ? null : text, text, option: value as string | null };
	const cell: Cell = { value, text };
	if (pinned.unit) cell.unit = pinned.unit;
	return cell;
}

/** One step, or null when it does not apply to this value (a unit step on a text). */
function applyStep(cell: Cell, step: ProjectionStep): Cell | null {
	switch (step.op) {
		case 'convert_unit': {
			if (typeof cell.value !== 'number' || !cell.unit) return cell.value === null ? cell : null;
			const amount = convertMeasure(cell.value, cell.unit, step.to);
			if (amount === null) return null;
			const value = Number(amount.toFixed(6));
			return { ...cell, value, text: String(value), unit: step.to };
		}
		case 'round': {
			if (typeof cell.value !== 'number') return cell.value === null ? cell : null;
			const value = Number(cell.value.toFixed(step.decimals));
			return { ...cell, value, text: String(value) };
		}
		case 'map_options': {
			if (cell.option === undefined) return null;
			if (cell.option === null) return cell;
			const mapped = Object.hasOwn(step.map, cell.option) ? step.map[cell.option] : cell.text;
			return { value: mapped, text: mapped };
		}
		case 'change_case': {
			if (typeof cell.value === 'number' || typeof cell.value === 'boolean') return null;
			const text = step.mode === 'upper' ? cell.text.toLocaleUpperCase() : cell.text.toLocaleLowerCase();
			const value = Array.isArray(cell.value)
				? cell.value.map((item) =>
						step.mode === 'upper' ? String(item).toLocaleUpperCase() : String(item).toLocaleLowerCase(),
					)
				: cell.value === null
					? null
					: text;
			return { ...cell, value, text };
		}
		case 'join': {
			if (!Array.isArray(cell.value)) return null;
			const text = cell.value.map(String).join(step.separator);
			return { value: text, text };
		}
		case 'with_unit': {
			if (!cell.unit) return null;
			if (cell.value === null) return cell;
			const text = `${cell.text} ${cell.unit}`;
			return { value: text, text };
		}
	}
}

function setPath(target: JsonObject, path: string, value: JsonValue): void {
	const keys = path.split('.');
	let node = target;
	for (const key of keys.slice(0, -1)) {
		const next = node[key];
		if (next === null || typeof next !== 'object' || Array.isArray(next)) node[key] = {};
		node = node[key] as JsonObject;
	}
	node[keys[keys.length - 1]] = value;
}

// ── Impact of moving the pin ──────────────────────────────────────────────────────────────

export type ProjectionImpactCode =
	| 'label_changed'
	| 'unit_changed'
	| 'kind_changed'
	| 'options_changed'
	| 'unmapped_option'
	| 'deprecated'
	| 'retired'
	| 'new_definition';

export type ProjectionImpactSeverity = 'info' | 'warning' | 'breaking';

export interface ProjectionImpact {
	code: ProjectionImpactCode;
	severity: ProjectionImpactSeverity;
	definition: string;
	/** The field's `as`; empty for a definition no field reads. */
	field: string;
	before?: string;
	after?: string;
}

const SEVERITY: Record<ProjectionImpactCode, ProjectionImpactSeverity> = {
	label_changed: 'info',
	unit_changed: 'info',
	options_changed: 'info',
	new_definition: 'info',
	deprecated: 'warning',
	unmapped_option: 'warning',
	kind_changed: 'breaking',
	retired: 'breaking',
};

/**
 * What moving `projection`'s pin to `to` (the latest revision by default) would change for this
 * consumer. Deterministic and exhaustive, like the PIM's `checkSheet`: every field, every code.
 * A label the consumer overrides is not reported. A unit change is a warning unless the field
 * converts to a fixed unit or prints the unit beside the number: otherwise a `width_cm` column
 * would silently start receiving millimetres.
 */
export function checkProjectionImpact(
	dictionary: AttributeDictionary,
	projection: AttributeProjection,
	to: number = latestRevision(dictionary).revision,
): ProjectionImpact[] {
	const from = dictionaryAt(dictionary, projection.dictionaryRevision);
	const target = dictionaryAt(dictionary, to);
	if (!from || !target || to <= projection.dictionaryRevision) return [];
	const out: ProjectionImpact[] = [];
	const push = (code: ProjectionImpactCode, definition: string, field: string, before?: string, after?: string) => {
		const impact: ProjectionImpact = { code, severity: SEVERITY[code], definition, field };
		if (before !== undefined) impact.before = before;
		if (after !== undefined) impact.after = after;
		out.push(impact);
	};
	const read = new Set(projection.fields.map((f) => f.from));

	for (const field of projection.fields) {
		const before = from.definitions.find((d) => d.id === field.from);
		const after = target.definitions.find((d) => d.id === field.from);
		if (!before || !after || before === after) continue;
		if (!field.label) {
			const a = definitionLabel(before, projection.locale, dictionary.sourceLocale);
			const b = definitionLabel(after, projection.locale, dictionary.sourceLocale);
			if (a !== b) push('label_changed', after.id, field.as, a, b);
		}
		if (before.kind !== after.kind) push('kind_changed', after.id, field.as, before.kind, after.kind);
		else if (before.unit !== after.unit) {
			push('unit_changed', after.id, field.as, before.unit ?? '', after.unit ?? '');
			// The number the consumer receives changes unit — harmless only if a step fixes or names it.
			const handled = field.steps?.some((s) => s.op === 'convert_unit' || s.op === 'with_unit');
			if (!handled) out[out.length - 1].severity = 'warning';
		}
		if (after.kind === 'select' && before.kind === 'select' && !jsonEqual(before.config, after.config)) {
			push('options_changed', after.id, field.as);
			const map = field.steps?.find((s) => s.op === 'map_options');
			if (map) {
				for (const option of (after.config.options as unknown as SelectOption[]) ?? []) {
					if (!Object.hasOwn(map.map, option.id)) push('unmapped_option', after.id, field.as, undefined, option.label);
				}
			}
		}
		if (after.status !== before.status) {
			if (after.status === 'retired') push('retired', after.id, field.as);
			else if (after.status === 'deprecated') push('deprecated', after.id, field.as);
		}
	}
	const known = new Set(from.definitions.map((d) => d.id));
	for (const definition of target.definitions) {
		if (!known.has(definition.id) && !read.has(definition.id) && definition.status !== 'retired') {
			push(
				'new_definition',
				definition.id,
				'',
				undefined,
				definitionLabel(definition, projection.locale, dictionary.sourceLocale),
			);
		}
	}
	return out;
}

/** The same projection, pinned to another revision. */
export function repinProjection(projection: AttributeProjection, revision: number): AttributeProjection {
	return { ...projection, dictionaryRevision: revision };
}

// ── Codec ─────────────────────────────────────────────────────────────────────────────────

export interface ProjectionProblem {
	path: string;
	message: string;
}

export type AttributeProjectionParse =
	| { ok: true; projection: AttributeProjection }
	| { ok: false; problems: ProjectionProblem[] };

/** Bounds of a projection document. */
export const PROJECTION_LIMITS = Object.freeze({ fields: 200, steps: 8, pathDepth: 4, mapEntries: 100, separator: 5 });

const SEGMENT = /^[A-Za-z_][A-Za-z0-9_-]{0,39}$/;
const CONSUMER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const stepFrame = v.variant('op', [
	v.strictObject({ op: v.literal('convert_unit'), to: v.picklist(MEASURE_UNITS) }),
	v.strictObject({ op: v.literal('round'), decimals: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(6)) }),
	v.strictObject({
		op: v.literal('map_options'),
		map: v.pipe(
			v.record(v.pipe(v.string(), v.maxLength(40)), v.pipe(v.string(), v.maxLength(120))),
			v.check((map) => Object.keys(map).length <= PROJECTION_LIMITS.mapEntries, 'Too many entries.'),
		),
	}),
	v.strictObject({ op: v.literal('change_case'), mode: v.picklist(['upper', 'lower']) }),
	v.strictObject({ op: v.literal('join'), separator: v.pipe(v.string(), v.maxLength(PROJECTION_LIMITS.separator)) }),
	v.strictObject({ op: v.literal('with_unit') }),
]);

const fieldFrame = v.strictObject({
	from: v.pipe(
		v.string(),
		v.check((id) => isDefinitionId(id), 'Not a definition id.'),
	),
	as: v.pipe(
		v.string(),
		v.check((path) => {
			const keys = path.split('.');
			return keys.length <= PROJECTION_LIMITS.pathDepth && keys.every((key) => SEGMENT.test(key));
		}, 'Not a field path.'),
	),
	label: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(DEFAULT_ATTRIBUTE_LIMITS.labelLength))),
	steps: v.optional(v.pipe(v.array(stepFrame), v.maxLength(PROJECTION_LIMITS.steps))),
	render: v.optional(
		v.strictObject({
			group: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(60))),
			display: v.optional(v.picklist(RENDER_DISPLAYS)),
			emphasis: v.optional(v.picklist(['strong', 'muted'])),
		}),
	),
});

const projectionFrame = v.strictObject({
	format: v.literal(ATTRIBUTE_PROJECTION_FORMAT),
	consumer: v.pipe(v.string(), v.maxLength(40), v.regex(CONSUMER)),
	name: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
	locale: v.pipe(
		v.string(),
		v.check((locale) => isLocaleTag(locale), 'Not a locale tag.'),
	),
	dictionaryRevision: v.pipe(v.number(), v.integer(), v.minValue(1)),
	output: v.picklist(PROJECTION_OUTPUTS),
	fields: v.pipe(v.array(fieldFrame), v.maxLength(PROJECTION_LIMITS.fields)),
});

/**
 * Parse untrusted input into a projection. Fails closed: an unknown step, an unknown render
 * hint or a path that collides with another field's (`specs` and `specs.width`) is refused.
 */
export function parseAttributeProjection(input: unknown): AttributeProjectionParse {
	const copied = copyBoundedJson(input, { depth: 8, entries: 20_000, stringLength: 2_000 });
	if (!copied.ok) return { ok: false, problems: [{ path: '', message: `Not plain JSON: ${copied.reason}.` }] };
	const parsed = v.safeParse(projectionFrame, copied.value);
	if (!parsed.success) {
		return {
			ok: false,
			problems: parsed.issues.map((issue) => ({
				path: (issue.path ?? []).map((item) => String(item.key)).join('.'),
				message: issue.message,
			})),
		};
	}
	const projection = parsed.output as AttributeProjection;
	const problems: ProjectionProblem[] = [];
	const paths = projection.fields.map((f) => f.as);
	paths.forEach((path, i) => {
		const clash = paths.some(
			(other, j) =>
				j !== i &&
				(other === path ||
					(projection.output === 'object' && (other.startsWith(`${path}.`) || path.startsWith(`${other}.`)))),
		);
		if (clash) problems.push({ path: `fields.${i}.as`, message: `"${path}" collides with another field.` });
		if (projection.output !== 'object' && path.includes('.'))
			problems.push({ path: `fields.${i}.as`, message: 'Only object output nests.' });
		const label = projection.fields[i].label;
		if (label !== undefined && !isLabel(label, DEFAULT_ATTRIBUTE_LIMITS))
			problems.push({ path: `fields.${i}.label`, message: 'Not a valid label.' });
	});
	if (problems.length > 0) return { ok: false, problems };
	return { ok: true, projection };
}

export function serializeAttributeProjection(projection: AttributeProjection): string {
	return canonicalJson(projection as unknown as JsonValue);
}
