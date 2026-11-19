/**
 * The attribute dictionary: attribute definitions shared by many records, with their whole
 * history. A self-describing record keeps working without one; a dictionary is what a record
 * binds to when its attributes must mean the same thing in every record and to every consumer
 * (a webshop, a marketplace feed, a printed datasheet — `projection.ts`).
 *
 * Three rules carry it:
 *
 * - **Identity is a definition id** (`def_…`), never a label. Labels are per locale and change.
 * - **History is append-only.** Every change is a new dictionary revision holding the whole set
 *   of definitions; a revision once written never changes, so a consumer pinned to revision 12
 *   reads exactly what revision 12 said, forever.
 * - **Nothing is deleted.** A definition is deprecated (still usable, flagged) or retired (no
 *   longer bound to new attributes); its id stays reserved in every later revision.
 *
 * Variants are not versions: the German and English label of one definition coexist in one
 * revision (`labels`); a consumer's own name for it lives in its projection. A *revision* is
 * only ever change over time.
 */
import * as v from 'valibot';
import { convertMeasure, isMeasureUnit, MEASURE_UNITS, type MeasureUnit } from '#lib/utils/measure.ts';
import { isLabel } from './codec.ts';
import { canonicalJson, copyBoundedJson, type JsonObject, type JsonValue, jsonEqual, utf8Length } from './json.ts';
import { type AttributeKindRegistry, isKindId } from './kinds.ts';
import { type AttributeLimits, DEFAULT_ATTRIBUTE_LIMITS } from './limits.ts';
import type { AttributeEngine, AttributeOperation } from './operations.ts';
import { type Attribute, type AttributeRecord, createDefinitionId, isDefinitionId } from './record.ts';

/** The persisted shape number of a dictionary document. */
export const ATTRIBUTE_DICTIONARY_FORMAT = 1;

export type DefinitionStatus = 'active' | 'deprecated' | 'retired';
export const DEFINITION_STATUSES: readonly DefinitionStatus[] = ['active', 'deprecated', 'retired'];

export interface AttributeDefinition {
	/** Stable identity: `def_` and 10 lowercase hex. Never shown, never reused. */
	id: string;
	/** A kind id from the application's registry. */
	kind: string;
	config: JsonObject;
	/** The unit a `number` definition's values are stated in, when they measure something. */
	unit?: MeasureUnit;
	/** Label per locale. The dictionary's source locale is always present. */
	labels: Record<string, string>;
	status: DefinitionStatus;
}

export interface DictionaryRevision {
	/** 1, 2, 3, … — contiguous, oldest first. */
	revision: number;
	/** What changed, in a person's words. */
	note: string;
	definitions: AttributeDefinition[];
}

export interface AttributeDictionary {
	format: typeof ATTRIBUTE_DICTIONARY_FORMAT;
	/** The locale every definition has a label in, and every other locale falls back to. */
	sourceLocale: string;
	revisions: DictionaryRevision[];
}

/** Bounds of a dictionary document, beside the record's (`limits.ts`). */
export interface DictionaryLimits {
	definitions: number;
	revisions: number;
	locales: number;
	noteLength: number;
	bytes: number;
}

export const DEFAULT_DICTIONARY_LIMITS: Readonly<DictionaryLimits> = Object.freeze({
	definitions: 200,
	revisions: 200,
	locales: 12,
	noteLength: 200,
	bytes: 1024 * 1024,
});

const LOCALE = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;

export function isLocaleTag(locale: string): boolean {
	return LOCALE.test(locale);
}

export function latestRevision(dictionary: AttributeDictionary): DictionaryRevision {
	return dictionary.revisions[dictionary.revisions.length - 1];
}

/** The dictionary as revision `revision` said it, or undefined when there is no such revision. */
export function dictionaryAt(dictionary: AttributeDictionary, revision: number): DictionaryRevision | undefined {
	return dictionary.revisions[revision - 1];
}

export function definitionAt(
	dictionary: AttributeDictionary,
	definitionId: string,
	revision: number,
): AttributeDefinition | undefined {
	return dictionaryAt(dictionary, revision)?.definitions.find((d) => d.id === definitionId);
}

/** The label a reader in `locale` sees: that locale's, else the source locale's. */
export function definitionLabel(definition: AttributeDefinition, locale: string, sourceLocale: string): string {
	return definition.labels[locale] ?? definition.labels[sourceLocale] ?? '';
}

// ── Changes ───────────────────────────────────────────────────────────────────────────────

/** One change to the dictionary. Each accepted change writes exactly one new revision. */
export type DictionaryChange =
	| { op: 'add'; kind: string; label: string; config?: JsonObject; unit?: MeasureUnit }
	| { op: 'relabel'; definition: string; locale: string; label: string }
	| { op: 'configure'; definition: string; config: JsonObject }
	| { op: 'set_unit'; definition: string; unit: MeasureUnit | null }
	| { op: 'change_kind'; definition: string; kind: string }
	| { op: 'set_status'; definition: string; status: DefinitionStatus };

export type DictionaryRefusalCode =
	| 'unknown_definition'
	| 'unknown_kind'
	| 'invalid_label'
	| 'invalid_locale'
	| 'invalid_config'
	| 'invalid_unit'
	| 'retired'
	| 'too_many_definitions'
	| 'too_many_revisions'
	| 'too_many_locales'
	| 'too_large'
	| 'unchanged';

export type DictionaryRevise =
	| { ok: true; dictionary: AttributeDictionary; revision: number; definitionId: string }
	| { ok: false; refusal: DictionaryRefusalCode };

export interface DictionaryEngine {
	kinds: AttributeKindRegistry;
	limits: AttributeLimits;
	dictionaryLimits: DictionaryLimits;
	createId: () => string;
}

export function createDictionaryEngine(
	kinds: AttributeKindRegistry,
	options: { limits?: AttributeLimits; dictionaryLimits?: DictionaryLimits; createId?: () => string } = {},
): DictionaryEngine {
	return {
		kinds,
		limits: options.limits ?? DEFAULT_ATTRIBUTE_LIMITS,
		dictionaryLimits: options.dictionaryLimits ?? DEFAULT_DICTIONARY_LIMITS,
		createId: options.createId ?? (() => createDefinitionId()),
	};
}

const refuseRevise = (refusal: DictionaryRefusalCode): DictionaryRevise => ({ ok: false, refusal });

/**
 * Apply one change, writing revision n + 1. The new revision shares every unchanged definition
 * object with the one before it, so a long history costs little in memory.
 */
export function reviseDictionary(
	dictionary: AttributeDictionary,
	change: DictionaryChange,
	note: string,
	engine: DictionaryEngine,
): DictionaryRevise {
	const { dictionaryLimits: bounds } = engine;
	if (dictionary.revisions.length >= bounds.revisions) return refuseRevise('too_many_revisions');
	const current = latestRevision(dictionary);
	const trimmedNote = note.trim().slice(0, bounds.noteLength);
	let definitions = current.definitions;
	let definitionId: string;

	if (change.op === 'add') {
		const kind = engine.kinds.get(change.kind);
		if (!kind) return refuseRevise('unknown_kind');
		if (definitions.length >= bounds.definitions) return refuseRevise('too_many_definitions');
		const label = change.label.trim();
		if (!label || !isLabel(label, engine.limits)) return refuseRevise('invalid_label');
		const config = change.config ? kind.parseConfig(change.config, engine.limits) : kind.defaultConfig();
		if (!config) return refuseRevise('invalid_config');
		if (change.unit !== undefined && (change.kind !== 'number' || !isMeasureUnit(change.unit)))
			return refuseRevise('invalid_unit');
		const definition: AttributeDefinition = {
			id: engine.createId(),
			kind: change.kind,
			config,
			labels: { [dictionary.sourceLocale]: label },
			status: 'active',
		};
		if (change.unit) definition.unit = change.unit;
		definitionId = definition.id;
		definitions = [...definitions, definition];
	} else {
		const before = definitions.find((d) => d.id === change.definition);
		if (!before) return refuseRevise('unknown_definition');
		if (before.status === 'retired') return refuseRevise('retired');
		const after = changedDefinition(before, change, dictionary.sourceLocale, engine);
		if (typeof after === 'string') return refuseRevise(after);
		if (jsonEqual(after as unknown as JsonValue, before as unknown as JsonValue)) return refuseRevise('unchanged');
		definitionId = before.id;
		definitions = definitions.map((d) => (d.id === before.id ? after : d));
	}

	const next: AttributeDictionary = {
		...dictionary,
		revisions: [
			...dictionary.revisions,
			{ revision: current.revision + 1, note: trimmedNote || describeChange(change), definitions },
		],
	};
	if (utf8Length(serializeAttributeDictionary(next)) > bounds.bytes) return refuseRevise('too_large');
	return { ok: true, dictionary: next, revision: current.revision + 1, definitionId };
}

function changedDefinition(
	before: AttributeDefinition,
	change: Exclude<DictionaryChange, { op: 'add' }>,
	sourceLocale: string,
	engine: DictionaryEngine,
): AttributeDefinition | DictionaryRefusalCode {
	switch (change.op) {
		case 'relabel': {
			if (!isLocaleTag(change.locale)) return 'invalid_locale';
			const label = change.label.trim();
			const labels = { ...before.labels };
			if (label === '') {
				// Clearing a translation falls back to the source label; the source label cannot be cleared.
				if (change.locale === sourceLocale) return 'invalid_label';
				delete labels[change.locale];
			} else {
				if (!isLabel(label, engine.limits)) return 'invalid_label';
				if (!(change.locale in labels) && Object.keys(labels).length >= engine.dictionaryLimits.locales)
					return 'too_many_locales';
				labels[change.locale] = label;
			}
			return { ...before, labels };
		}
		case 'configure': {
			const kind = engine.kinds.get(before.kind);
			if (!kind) return 'unknown_kind';
			const config = kind.parseConfig(change.config, engine.limits);
			if (!config) return 'invalid_config';
			return { ...before, config };
		}
		case 'set_unit': {
			if (change.unit === null) {
				const { unit: _dropped, ...rest } = before;
				return rest;
			}
			if (before.kind !== 'number' || !isMeasureUnit(change.unit)) return 'invalid_unit';
			return { ...before, unit: change.unit };
		}
		case 'change_kind': {
			const kind = engine.kinds.get(change.kind);
			if (!kind) return 'unknown_kind';
			const { unit: _dropped, ...rest } = before;
			const next: AttributeDefinition = { ...rest, kind: change.kind, config: kind.defaultConfig() };
			if (change.kind === 'number' && before.unit) next.unit = before.unit;
			return next;
		}
		case 'set_status':
			return { ...before, status: change.status };
	}
}

/** The note a revision gets when its author wrote none. Plain English: it is stored data. */
function describeChange(change: DictionaryChange): string {
	switch (change.op) {
		case 'add':
			return `Added "${change.label.trim()}"`;
		case 'relabel':
			return `Relabelled (${change.locale}) to "${change.label.trim()}"`;
		case 'configure':
			return 'Changed settings';
		case 'set_unit':
			return change.unit ? `Unit is now ${change.unit}` : 'Unit removed';
		case 'change_kind':
			return `Kind is now ${change.kind}`;
		case 'set_status':
			return `Marked ${change.status}`;
	}
}

// ── Differences between revisions ─────────────────────────────────────────────────────────

export type DefinitionChangePart = 'added' | 'labels' | 'kind' | 'config' | 'unit' | 'status';

export interface DefinitionChange {
	definition: string;
	parts: DefinitionChangePart[];
	before?: AttributeDefinition;
	after: AttributeDefinition;
}

/** What changed for each definition between two revisions, in the later revision's order. */
export function diffDictionaryRevisions(dictionary: AttributeDictionary, from: number, to: number): DefinitionChange[] {
	const a = dictionaryAt(dictionary, from);
	const b = dictionaryAt(dictionary, to);
	if (!a || !b) return [];
	const earlier = new Map(a.definitions.map((d) => [d.id, d]));
	const out: DefinitionChange[] = [];
	for (const after of b.definitions) {
		const before = earlier.get(after.id);
		if (before === after) continue;
		if (!before) {
			out.push({ definition: after.id, parts: ['added'], after });
			continue;
		}
		const parts: DefinitionChangePart[] = [];
		if (!jsonEqual(before.labels, after.labels)) parts.push('labels');
		if (before.kind !== after.kind) parts.push('kind');
		if (!jsonEqual(before.config, after.config)) parts.push('config');
		if (before.unit !== after.unit) parts.push('unit');
		if (before.status !== after.status) parts.push('status');
		if (parts.length > 0) out.push({ definition: after.id, parts, before, after });
	}
	return out;
}

// ── Records bound to a dictionary ─────────────────────────────────────────────────────────

/** An attribute of `definition`, as the record stores it: the definition's snapshot plus a value. */
function boundAttribute(
	id: string,
	definition: AttributeDefinition,
	revision: number,
	sourceLocale: string,
	value: JsonValue,
): Attribute {
	return {
		id,
		label: definitionLabel(definition, sourceLocale, sourceLocale),
		kind: definition.kind,
		value,
		config: definition.config,
		binding: { definition: definition.id, revision },
	};
}

/** Add an attribute bound to a definition of the dictionary's latest revision. */
export function bindAttribute(
	record: AttributeRecord,
	dictionary: AttributeDictionary,
	definitionId: string,
	engine: AttributeEngine,
	at = record.attributes.length,
): AttributeOperation {
	const current = latestRevision(dictionary);
	const definition = current.definitions.find((d) => d.id === definitionId);
	if (!definition) return { ok: false, refusal: 'unknown_attribute' };
	if (definition.status === 'retired') return { ok: false, refusal: 'retired_definition' };
	const kind = engine.kinds.get(definition.kind);
	if (!kind) return { ok: false, refusal: 'unknown_kind' };
	if (record.attributes.some((a) => a.binding?.definition === definitionId))
		return { ok: false, refusal: 'already_bound' };
	if (record.attributes.length >= engine.limits.attributes) return { ok: false, refusal: 'too_many_attributes' };
	if (!Number.isInteger(at) || at < 0 || at > record.attributes.length) return { ok: false, refusal: 'invalid_index' };
	const attribute = boundAttribute(
		engine.createId(),
		definition,
		current.revision,
		dictionary.sourceLocale,
		kind.empty(definition.config),
	);
	const attributes = [...record.attributes];
	attributes.splice(at, 0, attribute);
	return { ok: true, record: { ...record, attributes }, attributeId: attribute.id };
}

/** Turn a bound attribute into a local one: it keeps its label, kind, config and value. */
export function unbindAttribute(record: AttributeRecord, id: string): AttributeOperation {
	const attribute = record.attributes.find((a) => a.id === id);
	if (!attribute) return { ok: false, refusal: 'unknown_attribute' };
	if (!attribute.binding) return { ok: true, record, attributeId: id };
	const { binding: _dropped, ...local } = attribute;
	return {
		ok: true,
		record: { ...record, attributes: record.attributes.map((a) => (a.id === id ? local : a)) },
		attributeId: id,
	};
}

export type BindingSyncOutcome = 'updated' | 'converted' | 'kept_previous' | 'retired';

export interface BindingSync {
	attributeId: string;
	definition: string;
	from: number;
	to: number;
	outcome: BindingSyncOutcome;
}

export interface RecordSync {
	record: AttributeRecord;
	changes: BindingSync[];
}

/**
 * Bring every bound attribute up to the dictionary's latest revision. A relabel or a settings
 * change is copied; a unit change converts the value (18 cm → 180 mm); a kind change converts
 * through text the way `changeAttributeKind` does, keeping a lossy value as `previous`. A
 * retired definition's attribute is left as it is and reported — it is the user's to unbind.
 */
export function syncRecordToDictionary(
	record: AttributeRecord,
	dictionary: AttributeDictionary,
	engine: AttributeEngine,
): RecordSync {
	const current = latestRevision(dictionary);
	const changes: BindingSync[] = [];
	const attributes = record.attributes.map((attribute) => {
		const binding = attribute.binding;
		if (!binding || binding.revision >= current.revision) return attribute;
		const after = current.definitions.find((d) => d.id === binding.definition);
		const before = definitionAt(dictionary, binding.definition, binding.revision);
		if (!after) return attribute;
		const change = { attributeId: attribute.id, definition: after.id, from: binding.revision, to: current.revision };
		if (after.status === 'retired') {
			changes.push({ ...change, outcome: 'retired' });
			return attribute;
		}
		const moved = moveValue(attribute, before, after, engine);
		const next = boundAttribute(attribute.id, after, current.revision, dictionary.sourceLocale, moved.value);
		if (moved.previous) next.previous = moved.previous;
		else if (attribute.previous) next.previous = attribute.previous;
		if (jsonEqual(next as unknown as JsonValue, { ...attribute, binding: next.binding } as unknown as JsonValue)) {
			// Nothing this attribute shows changed — only the revision it is current with.
			return { ...attribute, binding: next.binding };
		}
		changes.push({ ...change, outcome: moved.outcome });
		return next;
	});
	if (changes.length === 0 && attributes.every((a, i) => a === record.attributes[i])) return { record, changes };
	return { record: { ...record, attributes }, changes };
}

/** The value an attribute holds once its definition moves from `before` to `after`. */
function moveValue(
	attribute: Attribute,
	before: AttributeDefinition | undefined,
	after: AttributeDefinition,
	engine: AttributeEngine,
): { value: JsonValue; outcome: BindingSyncOutcome; previous?: Attribute['previous'] } {
	const to = engine.kinds.get(after.kind);
	if (!to) return { value: attribute.value, outcome: 'updated' };
	if (attribute.kind === after.kind) {
		const unitChanged = before?.unit && after.unit && before.unit !== after.unit;
		if (unitChanged && typeof attribute.value === 'number') {
			const converted = convertMeasure(attribute.value, before.unit as MeasureUnit, after.unit as MeasureUnit);
			if (converted !== null) return { value: Number(converted.toFixed(6)), outcome: 'converted' };
		}
		// Same kind, new config (say, fewer options): the value stays if the new config accepts it.
		if (to.accepts(attribute.value, after.config, engine.limits)) return { value: attribute.value, outcome: 'updated' };
		return {
			value: to.empty(after.config),
			outcome: 'kept_previous',
			previous: { kind: attribute.kind, value: attribute.value, config: attribute.config },
		};
	}
	const from = engine.kinds.get(attribute.kind);
	const text = from ? from.text(attribute.value, attribute.config) : '';
	const converted = from ? to.fromText(text, after.config, engine.limits) : undefined;
	if (converted !== undefined && to.accepts(converted, after.config, engine.limits)) {
		const exact = to.text(converted, after.config) === text;
		if (exact) return { value: converted, outcome: 'converted' };
		return {
			value: converted,
			outcome: 'kept_previous',
			previous: { kind: attribute.kind, value: attribute.value, config: attribute.config },
		};
	}
	return {
		value: to.empty(after.config),
		outcome: 'kept_previous',
		previous: { kind: attribute.kind, value: attribute.value, config: attribute.config },
	};
}

export type BindingFindingCode =
	| 'stale_binding'
	| 'deprecated_definition'
	| 'retired_definition'
	| 'unknown_definition';

export interface BindingFinding {
	code: BindingFindingCode;
	attributeId: string;
	definition: string;
}

/** Soft findings about a record's bindings against a dictionary. Never blocks a save. */
export function checkRecordBindings(record: AttributeRecord, dictionary: AttributeDictionary): BindingFinding[] {
	const current = latestRevision(dictionary);
	const out: BindingFinding[] = [];
	for (const attribute of record.attributes) {
		const binding = attribute.binding;
		if (!binding) continue;
		const definition = current.definitions.find((d) => d.id === binding.definition);
		const finding = (code: BindingFindingCode) =>
			out.push({ code, attributeId: attribute.id, definition: binding.definition });
		if (!definition || binding.revision > current.revision) {
			finding('unknown_definition');
			continue;
		}
		if (definition.status === 'retired') finding('retired_definition');
		else if (definition.status === 'deprecated') finding('deprecated_definition');
		if (binding.revision < current.revision && diffDefinition(dictionary, binding.definition, binding.revision))
			finding('stale_binding');
	}
	return out;
}

/** Whether a definition reads differently at the latest revision than at `revision`. */
function diffDefinition(dictionary: AttributeDictionary, definitionId: string, revision: number): boolean {
	const before = definitionAt(dictionary, definitionId, revision);
	const after = latestRevision(dictionary).definitions.find((d) => d.id === definitionId);
	return before !== after;
}

/** Promote a local attribute: a new definition from its label, kind and config, and the attribute bound to it. */
export function promoteAttribute(
	record: AttributeRecord,
	dictionary: AttributeDictionary,
	attributeId: string,
	dictionaryEngine: DictionaryEngine,
):
	| { ok: true; record: AttributeRecord; dictionary: AttributeDictionary }
	| { ok: false; refusal: DictionaryRefusalCode } {
	const attribute = record.attributes.find((a) => a.id === attributeId);
	if (!attribute) return { ok: false, refusal: 'unknown_definition' };
	if (attribute.binding) return { ok: false, refusal: 'unchanged' };
	const revised = reviseDictionary(
		dictionary,
		{ op: 'add', kind: attribute.kind, label: attribute.label, config: attribute.config },
		`Promoted "${attribute.label.trim()}" from a record`,
		dictionaryEngine,
	);
	if (!revised.ok) return revised;
	const definition = latestRevision(revised.dictionary).definitions.find((d) => d.id === revised.definitionId);
	if (!definition) return { ok: false, refusal: 'unknown_definition' };
	const bound = boundAttribute(
		attribute.id,
		definition,
		revised.revision,
		revised.dictionary.sourceLocale,
		attribute.value,
	);
	return {
		ok: true,
		dictionary: revised.dictionary,
		record: { ...record, attributes: record.attributes.map((a) => (a.id === attributeId ? bound : a)) },
	};
}

// ── Codec ─────────────────────────────────────────────────────────────────────────────────

export type DictionaryProblemCode =
	| 'invalid_json'
	| 'too_large'
	| 'invalid_shape'
	| 'newer_format'
	| 'invalid_revision'
	| 'duplicate_id'
	| 'dropped_definition'
	| 'unknown_kind'
	| 'invalid_config'
	| 'invalid_label'
	| 'invalid_unit'
	| 'too_many';

export interface DictionaryProblem {
	code: DictionaryProblemCode;
	path: string;
	message: string;
}

export type AttributeDictionaryParse =
	| { ok: true; dictionary: AttributeDictionary }
	| { ok: false; problems: DictionaryProblem[] };

const definitionFrame = v.strictObject({
	id: v.string(),
	kind: v.string(),
	config: v.unknown(),
	unit: v.optional(v.string()),
	labels: v.record(v.string(), v.string()),
	status: v.picklist(DEFINITION_STATUSES),
});

const revisionFrame = v.strictObject({
	revision: v.pipe(v.number(), v.integer(), v.minValue(1)),
	note: v.string(),
	definitions: v.array(v.unknown()),
});

const dictionaryFrame = v.strictObject({
	format: v.number(),
	sourceLocale: v.string(),
	revisions: v.pipe(v.array(v.unknown()), v.minLength(1)),
});

export interface DictionaryCodecOptions {
	kinds: AttributeKindRegistry;
	limits?: AttributeLimits;
	dictionaryLimits?: DictionaryLimits;
}

/**
 * Parse untrusted input into a dictionary, failing closed with every problem named. Unlike a
 * record, a dictionary refuses a kind its application does not know: the dictionary is the
 * authority the records and consumers lean on, so it must be one this application can check.
 */
export function parseAttributeDictionary(input: unknown, options: DictionaryCodecOptions): AttributeDictionaryParse {
	const limits = options.limits ?? DEFAULT_ATTRIBUTE_LIMITS;
	const bounds = options.dictionaryLimits ?? DEFAULT_DICTIONARY_LIMITS;
	const problems: DictionaryProblem[] = [];
	const fail = (code: DictionaryProblemCode, path: string, message: string): AttributeDictionaryParse => ({
		ok: false,
		problems: [{ code, path, message }],
	});

	const copied = copyBoundedJson(input, { depth: 12, entries: bounds.bytes, stringLength: limits.multilineLength });
	if (!copied.ok) return fail('invalid_shape', '', `The dictionary is not plain JSON: ${copied.reason}.`);
	const frame = v.safeParse(dictionaryFrame, copied.value);
	if (!frame.success) return fail('invalid_shape', '', 'The dictionary needs format, sourceLocale and revisions.');
	const { format, sourceLocale, revisions: rawRevisions } = frame.output;
	if (format > ATTRIBUTE_DICTIONARY_FORMAT)
		return fail('newer_format', 'format', `Format ${format} is newer than this build.`);
	if (format !== ATTRIBUTE_DICTIONARY_FORMAT) return fail('invalid_shape', 'format', 'Not a dictionary format.');
	if (!isLocaleTag(sourceLocale)) return fail('invalid_shape', 'sourceLocale', 'Not a locale tag.');
	if (rawRevisions.length > bounds.revisions) return fail('too_many', 'revisions', 'Too many revisions.');

	const revisions: DictionaryRevision[] = [];
	let previousIds = new Set<string>();
	rawRevisions.forEach((raw, r) => {
		const path = `revisions[${r}]`;
		const parsed = v.safeParse(revisionFrame, raw);
		if (!parsed.success) {
			problems.push({ code: 'invalid_shape', path, message: 'Not a revision.' });
			return;
		}
		const { revision, note, definitions: rawDefinitions } = parsed.output;
		if (revision !== r + 1)
			problems.push({ code: 'invalid_revision', path: `${path}.revision`, message: `Expected revision ${r + 1}.` });
		if (note.length > bounds.noteLength || !isLabel(note, { ...limits, labelLength: bounds.noteLength }))
			problems.push({ code: 'invalid_label', path: `${path}.note`, message: 'Not a valid note.' });
		if (rawDefinitions.length > bounds.definitions)
			problems.push({ code: 'too_many', path: `${path}.definitions`, message: 'Too many definitions.' });
		const ids = new Set<string>();
		const definitions: AttributeDefinition[] = [];
		rawDefinitions.forEach((rawDefinition, d) => {
			const definition = parseDefinition(
				rawDefinition,
				`${path}.definitions[${d}]`,
				sourceLocale,
				options.kinds,
				limits,
				bounds,
				problems,
			);
			if (!definition) return;
			if (ids.has(definition.id))
				problems.push({
					code: 'duplicate_id',
					path: `${path}.definitions[${d}].id`,
					message: 'This id is used twice.',
				});
			ids.add(definition.id);
			definitions.push(definition);
		});
		for (const id of previousIds) {
			if (!ids.has(id))
				problems.push({
					code: 'dropped_definition',
					path,
					message: `Definition ${id} disappeared; retire it instead.`,
				});
		}
		previousIds = ids;
		revisions.push({ revision, note, definitions });
	});
	if (problems.length > 0) return { ok: false, problems };

	// Unchanged definitions share one object across revisions, as `reviseDictionary` writes them.
	for (let i = 1; i < revisions.length; i++) {
		const earlier = new Map(revisions[i - 1].definitions.map((d) => [d.id, d]));
		revisions[i].definitions = revisions[i].definitions.map((d) => {
			const same = earlier.get(d.id);
			return same && jsonEqual(same as unknown as JsonValue, d as unknown as JsonValue) ? same : d;
		});
	}
	const dictionary: AttributeDictionary = { format: ATTRIBUTE_DICTIONARY_FORMAT, sourceLocale, revisions };
	if (utf8Length(serializeAttributeDictionary(dictionary)) > bounds.bytes)
		return fail('too_large', '', 'The dictionary is too large.');
	return { ok: true, dictionary };
}

function parseDefinition(
	raw: unknown,
	path: string,
	sourceLocale: string,
	kinds: AttributeKindRegistry,
	limits: AttributeLimits,
	bounds: DictionaryLimits,
	problems: DictionaryProblem[],
): AttributeDefinition | undefined {
	const frame = v.safeParse(definitionFrame, raw);
	if (!frame.success) {
		problems.push({ code: 'invalid_shape', path, message: 'Not an attribute definition.' });
		return undefined;
	}
	const { id, kind: kindId, config, unit, labels, status } = frame.output;
	const before = problems.length;
	if (!isDefinitionId(id))
		problems.push({ code: 'invalid_shape', path: `${path}.id`, message: 'Not a definition id.' });
	const kind = isKindId(kindId) ? kinds.get(kindId) : undefined;
	if (!kind) problems.push({ code: 'unknown_kind', path: `${path}.kind`, message: `Unknown kind "${kindId}".` });
	const parsedConfig = kind?.parseConfig(config as JsonValue, limits);
	if (kind && !parsedConfig)
		problems.push({ code: 'invalid_config', path: `${path}.config`, message: `Not a valid ${kindId} config.` });
	if (unit !== undefined && (kindId !== 'number' || !isMeasureUnit(unit)))
		problems.push({
			code: 'invalid_unit',
			path: `${path}.unit`,
			message: `Units are ${MEASURE_UNITS.join(', ')}, on numbers only.`,
		});
	const locales = Object.keys(labels);
	if (locales.length > bounds.locales)
		problems.push({ code: 'too_many', path: `${path}.labels`, message: 'Too many locales.' });
	if (!labels[sourceLocale]?.trim())
		problems.push({ code: 'invalid_label', path: `${path}.labels`, message: `No ${sourceLocale} label.` });
	for (const locale of locales) {
		if (!isLocaleTag(locale) || !isLabel(labels[locale], limits))
			problems.push({ code: 'invalid_label', path: `${path}.labels.${locale}`, message: 'Not a valid label.' });
	}
	if (problems.length > before || !parsedConfig) return undefined;
	const definition: AttributeDefinition = { id, kind: kindId, config: parsedConfig, labels: { ...labels }, status };
	if (unit) definition.unit = unit as MeasureUnit;
	return definition;
}

/** Parse text, checking the byte bound before `JSON.parse`. */
export function parseAttributeDictionaryText(text: string, options: DictionaryCodecOptions): AttributeDictionaryParse {
	const bounds = options.dictionaryLimits ?? DEFAULT_DICTIONARY_LIMITS;
	if (utf8Length(text) > bounds.bytes)
		return { ok: false, problems: [{ code: 'too_large', path: '', message: 'The dictionary is too large.' }] };
	try {
		return parseAttributeDictionary(JSON.parse(text), options);
	} catch {
		return { ok: false, problems: [{ code: 'invalid_json', path: '', message: 'Not valid JSON.' }] };
	}
}

/** Canonical text: sorted keys, no whitespace. */
export function serializeAttributeDictionary(dictionary: AttributeDictionary): string {
	return canonicalJson(dictionary as unknown as JsonValue);
}
