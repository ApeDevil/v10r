/**
 * The record at its edges: parsing untrusted input into an `AttributeRecord`, and writing one
 * out as canonical text. Every writer — the editor, an import, the server's PUT — goes through
 * `parseAttributeRecord`, so a record the browser accepts is one the server accepts.
 *
 * Parsing fails closed. A record with one bad attribute is refused whole, with every problem
 * named; nothing is trimmed, coerced or dropped to make it fit, because a "corrected" record
 * written back would silently delete what the user had. The two things that are *not* refused
 * are what a newer application may legitimately have written:
 *
 * - an attribute whose kind this registry does not know is kept, opaque and bounded, and
 *   written back unchanged — an older editor never destroys a newer kind's data;
 * - a soft finding (a number past its max, a duplicate label) is a diagnostic, not a refusal.
 *
 * A record of a *newer format* is refused: its structure may mean something this code cannot
 * know, and the caller must not write over it (`newer_format`).
 */
import * as v from 'valibot';
import {
	canonicalJson,
	copyBoundedJson,
	hasNul,
	type JsonBounds,
	type JsonObject,
	type JsonValue,
	utf8Length,
} from './json.ts';
import { type AttributeKindRegistry, hasControlCharacter, isKindId } from './kinds.ts';
import { type AttributeLimits, DEFAULT_ATTRIBUTE_LIMITS } from './limits.ts';
import {
	ATTRIBUTE_RECORD_FORMAT,
	type Attribute,
	type AttributeRecord,
	isAttributeId,
	type PreviousAttributeValue,
	type RemovedAttribute,
} from './record.ts';

export type AttributeRecordProblemCode =
	| 'invalid_json'
	| 'too_large'
	| 'invalid_shape'
	| 'invalid_format'
	| 'newer_format'
	| 'too_many_attributes'
	| 'too_many_removed'
	| 'duplicate_id'
	| 'invalid_label'
	| 'invalid_config'
	| 'invalid_value'
	| 'invalid_opaque';

export interface AttributeRecordProblem {
	code: AttributeRecordProblemCode;
	/** Where, as a JSON path: `attributes[3].value`. Empty for the whole record. */
	path: string;
	message: string;
}

export type AttributeRecordParse =
	| { ok: true; record: AttributeRecord }
	| { ok: false; problems: AttributeRecordProblem[] };

/** Turns a document of format N into format N + 1. Pure; receives only plain JSON. */
export type AttributeRecordUpcaster = (document: JsonObject) => JsonObject;

export interface AttributeCodecOptions {
	kinds: AttributeKindRegistry;
	limits?: AttributeLimits;
	/** Keyed by the format they read. Empty while format 1 is the only format. */
	upcasters?: Readonly<Record<number, AttributeRecordUpcaster>>;
	/** The format this build writes; only tests pass another. */
	format?: number;
}

/** Upgrades from older formats. Add `1: (doc) => …` when format 2 exists — never edit a shipped one. */
export const ATTRIBUTE_RECORD_UPCASTERS: Readonly<Record<number, AttributeRecordUpcaster>> = Object.freeze({});

const attributeFrame = v.strictObject({
	id: v.string(),
	label: v.string(),
	kind: v.string(),
	value: v.unknown(),
	config: v.unknown(),
	previous: v.optional(v.strictObject({ kind: v.string(), value: v.unknown(), config: v.unknown() })),
});

const removedFrame = v.strictObject({
	attribute: v.unknown(),
	index: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

const recordFrame = v.strictObject({
	format: v.literal(ATTRIBUTE_RECORD_FORMAT),
	attributes: v.array(v.unknown()),
	removed: v.array(v.unknown()),
});

function opaqueBounds(limits: AttributeLimits): JsonBounds {
	return { depth: limits.opaqueDepth, entries: limits.opaqueEntries, stringLength: limits.multilineLength };
}

/** Parse text — a request body, a file, a stored draft. The byte bound is checked before `JSON.parse`. */
export function parseAttributeRecordText(text: string, options: AttributeCodecOptions): AttributeRecordParse {
	const limits = options.limits ?? DEFAULT_ATTRIBUTE_LIMITS;
	if (utf8Length(text) > limits.recordBytes) {
		return fail('too_large', '', `The record is larger than ${limits.recordBytes} bytes.`);
	}
	let input: unknown;
	try {
		input = JSON.parse(text);
	} catch {
		return fail('invalid_json', '', 'The record is not valid JSON.');
	}
	return parseAttributeRecord(input, options);
}

/** Parse an already-decoded value. Never throws; never returns a record that shares objects with `input`. */
export function parseAttributeRecord(input: unknown, options: AttributeCodecOptions): AttributeRecordParse {
	const limits = options.limits ?? DEFAULT_ATTRIBUTE_LIMITS;
	const current = options.format ?? ATTRIBUTE_RECORD_FORMAT;
	const upcasters = options.upcasters ?? ATTRIBUTE_RECORD_UPCASTERS;

	// One bounded copy first: nothing below walks the caller's object, its prototypes or getters.
	const copied = copyBoundedJson(input, {
		depth: limits.opaqueDepth + 6,
		entries: limits.recordBytes,
		stringLength: limits.multilineLength,
	});
	if (!copied.ok) return fail('invalid_shape', '', `The record is not plain JSON: ${copied.reason}.`);
	let document = copied.value;
	if (document === null || typeof document !== 'object' || Array.isArray(document)) {
		return fail('invalid_shape', '', 'The record must be a JSON object.');
	}

	const format = document.format;
	if (typeof format !== 'number' || !Number.isInteger(format) || format < 1) {
		return fail('invalid_format', 'format', 'The record has no valid format number.');
	}
	if (format > current) {
		return fail(
			'newer_format',
			'format',
			`The record was written in format ${format}; this editor reads up to ${current}.`,
		);
	}
	for (let from = format; from < current; from++) {
		const upcaster = upcasters[from];
		if (!upcaster) return fail('invalid_format', 'format', `No upgrade from format ${from}.`);
		document = upcaster(document);
	}

	if (document.format !== current)
		return fail('invalid_format', 'format', `An upgrade did not reach format ${current}.`);
	// A test build may read a later format; what it hands back is always this build's shape.
	const frame = v.safeParse(recordFrame, { ...document, format: ATTRIBUTE_RECORD_FORMAT });
	if (!frame.success) return { ok: false, problems: frame.issues.map(issueProblem) };

	const problems: AttributeRecordProblem[] = [];
	const { attributes: rawAttributes, removed: rawRemoved } = frame.output;
	if (rawAttributes.length > limits.attributes) {
		problems.push(problem('too_many_attributes', 'attributes', `More than ${limits.attributes} attributes.`));
	}
	if (rawRemoved.length > limits.removed) {
		problems.push(problem('too_many_removed', 'removed', `More than ${limits.removed} removed attributes.`));
	}
	if (problems.length > 0) return { ok: false, problems };

	const seen = new Set<string>();
	const attributes: Attribute[] = [];
	rawAttributes.forEach((raw, i) => {
		const attribute = parseAttribute(raw, `attributes[${i}]`, options.kinds, limits, problems);
		if (!attribute) return;
		if (seen.has(attribute.id)) problems.push(problem('duplicate_id', `attributes[${i}].id`, 'This id is used twice.'));
		seen.add(attribute.id);
		attributes.push(attribute);
	});
	const removed: RemovedAttribute[] = [];
	rawRemoved.forEach((raw, i) => {
		const entry = v.safeParse(removedFrame, raw);
		if (!entry.success) {
			problems.push(...entry.issues.map((issue) => issueProblem(issue, `removed[${i}]`)));
			return;
		}
		const attribute = parseAttribute(
			entry.output.attribute,
			`removed[${i}].attribute`,
			options.kinds,
			limits,
			problems,
		);
		if (!attribute) return;
		if (seen.has(attribute.id))
			problems.push(problem('duplicate_id', `removed[${i}].attribute.id`, 'This id is used twice.'));
		seen.add(attribute.id);
		removed.push({ attribute, index: entry.output.index });
	});
	if (problems.length > 0) return { ok: false, problems };

	const record: AttributeRecord = { format: ATTRIBUTE_RECORD_FORMAT, attributes, removed };
	if (utf8Length(serializeAttributeRecord(record)) > limits.recordBytes) {
		return fail('too_large', '', `The record is larger than ${limits.recordBytes} bytes.`);
	}
	return { ok: true, record };
}

function parseAttribute(
	raw: unknown,
	path: string,
	kinds: AttributeKindRegistry,
	limits: AttributeLimits,
	problems: AttributeRecordProblem[],
): Attribute | undefined {
	const frame = v.safeParse(attributeFrame, raw);
	if (!frame.success) {
		problems.push(...frame.issues.map((issue) => issueProblem(issue, path)));
		return undefined;
	}
	const { id, label, kind, value, config, previous } = frame.output;
	const before = problems.length;
	if (!isAttributeId(id)) problems.push(problem('invalid_shape', `${path}.id`, 'Not an attribute id.'));
	if (!isLabel(label, limits)) problems.push(problem('invalid_label', `${path}.label`, 'Not a valid label.'));
	if (!isKindId(kind)) problems.push(problem('invalid_shape', `${path}.kind`, 'Not a kind id.'));
	const typed =
		problems.length === before ? parseTyped(kind, value, config, `${path}`, kinds, limits, problems) : undefined;
	let kept: PreviousAttributeValue | undefined;
	if (previous) {
		if (!isKindId(previous.kind)) problems.push(problem('invalid_shape', `${path}.previous.kind`, 'Not a kind id.'));
		else kept = parseTyped(previous.kind, previous.value, previous.config, `${path}.previous`, kinds, limits, problems);
	}
	if (!typed || problems.length > before) return undefined;
	const attribute: Attribute = { id, label, kind, value: typed.value, config: typed.config };
	if (kept) attribute.previous = kept;
	return attribute;
}

/** A kind, value and config that belong together — checked by the kind, or bounded as opaque JSON. */
function parseTyped(
	kindId: string,
	value: unknown,
	config: unknown,
	path: string,
	kinds: AttributeKindRegistry,
	limits: AttributeLimits,
	problems: AttributeRecordProblem[],
): PreviousAttributeValue | undefined {
	const kind = kinds.get(kindId);
	if (!kind) {
		// Not ours to understand — ours to keep. Bounded so it cannot be a resource attack.
		const opaqueValue = copyBoundedJson(value, opaqueBounds(limits));
		const opaqueConfig = copyBoundedJson(config, opaqueBounds(limits));
		if (!opaqueValue.ok || !opaqueConfig.ok || !isObject(opaqueConfig.value)) {
			problems.push(problem('invalid_opaque', path, `Unknown kind "${kindId}" with a value that is not bounded JSON.`));
			return undefined;
		}
		return { kind: kindId, value: opaqueValue.value, config: opaqueConfig.value };
	}
	const parsedConfig = kind.parseConfig(config as JsonValue, limits);
	if (!parsedConfig) {
		problems.push(problem('invalid_config', `${path}.config`, `Not a valid ${kindId} config.`));
		return undefined;
	}
	if (!kind.accepts(value as JsonValue, parsedConfig, limits)) {
		problems.push(problem('invalid_value', `${path}.value`, `Not a valid ${kindId} value.`));
		return undefined;
	}
	return { kind: kindId, value: value as JsonValue, config: parsedConfig };
}

export function isLabel(label: string, limits: AttributeLimits): boolean {
	return label.length <= limits.labelLength && !hasControlCharacter(label) && !hasNul(label);
}

function isObject(value: JsonValue): value is JsonObject {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Canonical text of a record: sorted keys, no whitespace. Equal records give equal bytes, so
 * the text can be compared, hashed or diffed — and `parse(serialize(r))` equals `r`.
 */
export function serializeAttributeRecord(record: AttributeRecord): string {
	return canonicalJson(record as unknown as JsonValue);
}

function problem(code: AttributeRecordProblemCode, path: string, message: string): AttributeRecordProblem {
	return { code, path, message };
}

function fail(code: AttributeRecordProblemCode, path: string, message: string): AttributeRecordParse {
	return { ok: false, problems: [problem(code, path, message)] };
}

function issueProblem(issue: v.BaseIssue<unknown>, prefix = ''): AttributeRecordProblem {
	const keys = (issue.path ?? []).map((item) => String(item.key));
	const path = keys.reduce((acc, key) => (/^\d+$/.test(key) ? `${acc}[${key}]` : acc ? `${acc}.${key}` : key), prefix);
	return problem('invalid_shape', path, issue.message);
}
