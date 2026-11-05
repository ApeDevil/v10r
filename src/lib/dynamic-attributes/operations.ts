/**
 * Everything a user can do to a record, as pure functions: each takes a record and returns a
 * new one, never mutating its input. Unchanged attributes keep their object identity, so a
 * renderer keyed by attribute id redraws only the attribute that changed, and an undo stack is
 * a list of snapshots that share almost everything.
 *
 * A refused operation returns a refusal and no record — the caller keeps the one it had. The
 * refusals are the same bounds `parseAttributeRecord` enforces, so an editor can never build a
 * record its own server would refuse.
 *
 * Data is never lost implicitly:
 * - a lossy kind change keeps the old value as `previous` until it is restored or discarded;
 * - a removed attribute goes to `removed` with its place, and can be restored from there;
 * - a label change never touches identity, value or order.
 */
import { isLabel, serializeAttributeRecord } from './codec.ts';
import { type JsonObject, type JsonValue, jsonEqual, utf8Length } from './json.ts';
import type { AttributeKind, AttributeKindRegistry } from './kinds.ts';
import { type AttributeLimits, DEFAULT_ATTRIBUTE_LIMITS } from './limits.ts';
import { type Attribute, type AttributeRecord, createAttributeId } from './record.ts';

export interface AttributeEngine {
	kinds: AttributeKindRegistry;
	limits: AttributeLimits;
	/** Mints attribute ids; injectable for deterministic tests. */
	createId: () => string;
}

export function createAttributeEngine(
	kinds: AttributeKindRegistry,
	options: { limits?: AttributeLimits; createId?: () => string } = {},
): AttributeEngine {
	return {
		kinds,
		limits: options.limits ?? DEFAULT_ATTRIBUTE_LIMITS,
		createId: options.createId ?? (() => createAttributeId()),
	};
}

export type AttributeRefusalCode =
	| 'too_many_attributes'
	| 'too_large'
	| 'unknown_attribute'
	| 'unknown_kind'
	| 'invalid_label'
	| 'invalid_value'
	| 'invalid_config'
	| 'invalid_index'
	| 'no_previous_value';

export type AttributeOperation =
	| { ok: true; record: AttributeRecord; attributeId: string }
	| { ok: false; refusal: AttributeRefusalCode };

const refuse = (refusal: AttributeRefusalCode): AttributeOperation => ({ ok: false, refusal });

/** Finish an operation: the size bound is the one check that needs the whole record. */
function done(engine: AttributeEngine, record: AttributeRecord, attributeId: string): AttributeOperation {
	if (utf8Length(serializeAttributeRecord(record)) > engine.limits.recordBytes) return refuse('too_large');
	return { ok: true, record, attributeId };
}

function replace(record: AttributeRecord, next: Attribute): AttributeRecord {
	return { ...record, attributes: record.attributes.map((a) => (a.id === next.id ? next : a)) };
}

function find(record: AttributeRecord, id: string): Attribute | undefined {
	return record.attributes.find((a) => a.id === id);
}

export interface NewAttribute {
	kind?: string;
	label?: string;
	/** Position to insert at; the end when omitted. */
	at?: number;
}

/** Add an attribute holding its kind's empty value. Fast path: `addAttribute(r, {}, e)` is a blank text row. */
export function addAttribute(
	record: AttributeRecord,
	input: NewAttribute,
	engine: AttributeEngine,
): AttributeOperation {
	const kindId = input.kind ?? 'text';
	const kind = engine.kinds.get(kindId);
	if (!kind) return refuse('unknown_kind');
	if (record.attributes.length >= engine.limits.attributes) return refuse('too_many_attributes');
	const label = input.label ?? '';
	if (!isLabel(label, engine.limits)) return refuse('invalid_label');
	const at = input.at ?? record.attributes.length;
	if (!Number.isInteger(at) || at < 0 || at > record.attributes.length) return refuse('invalid_index');
	const config = kind.defaultConfig();
	const attribute: Attribute = { id: engine.createId(), label, kind: kindId, value: kind.empty(config), config };
	const attributes = [...record.attributes];
	attributes.splice(at, 0, attribute);
	return done(engine, { ...record, attributes }, attribute.id);
}

export function relabelAttribute(
	record: AttributeRecord,
	id: string,
	label: string,
	engine: AttributeEngine,
): AttributeOperation {
	const attribute = find(record, id);
	if (!attribute) return refuse('unknown_attribute');
	if (!isLabel(label, engine.limits)) return refuse('invalid_label');
	if (attribute.label === label) return { ok: true, record, attributeId: id };
	return done(engine, replace(record, { ...attribute, label }), id);
}

export function setAttributeValue(
	record: AttributeRecord,
	id: string,
	value: JsonValue,
	engine: AttributeEngine,
): AttributeOperation {
	const attribute = find(record, id);
	if (!attribute) return refuse('unknown_attribute');
	const kind = engine.kinds.get(attribute.kind);
	// An unknown kind's value is opaque: kept, shown, never edited by code that cannot check it.
	if (!kind) return refuse('unknown_kind');
	if (!kind.accepts(value, attribute.config, engine.limits)) return refuse('invalid_value');
	if (jsonEqual(attribute.value, value)) return { ok: true, record, attributeId: id };
	return done(engine, replace(record, { ...attribute, value }), id);
}

/** Replace an attribute's config. The current value must remain a value of the kind. */
export function configureAttribute(
	record: AttributeRecord,
	id: string,
	config: JsonObject,
	engine: AttributeEngine,
): AttributeOperation {
	const attribute = find(record, id);
	if (!attribute) return refuse('unknown_attribute');
	const kind = engine.kinds.get(attribute.kind);
	if (!kind) return refuse('unknown_kind');
	const parsed = kind.parseConfig(config, engine.limits);
	if (!parsed) return refuse('invalid_config');
	if (!kind.accepts(attribute.value, parsed, engine.limits)) return refuse('invalid_value');
	return done(engine, replace(record, { ...attribute, config: parsed }), id);
}

/** How a value of `from` would read as `to`, and whether nothing is lost on the way. */
export interface KindConversion {
	value: JsonValue;
	config: JsonObject;
	exact: boolean;
}

export function convertAttributeValue(
	attribute: Attribute,
	to: AttributeKind,
	engine: AttributeEngine,
): KindConversion {
	const from = engine.kinds.get(attribute.kind);
	// Unknown source: its text is not knowable, so nothing converts — the value is kept as `previous`.
	if (!from) {
		const config = to.defaultConfig();
		return { value: to.empty(config), config, exact: false };
	}
	const text = from.text(attribute.value, attribute.config);
	const config = to.configFromText ? to.configFromText(text, engine.limits) : to.defaultConfig();
	const converted = to.fromText(text, config, engine.limits);
	if (converted === undefined || !to.accepts(converted, config, engine.limits)) {
		return { value: to.empty(config), config, exact: false };
	}
	return { value: converted, config, exact: to.text(converted, config) === text };
}

/**
 * Change an attribute's kind. An exact conversion simply converts. A lossy one converts what it
 * can and keeps the old kind, value and config as `previous` — the first one, if an earlier
 * change already kept one, because that is the value the user actually entered. Changing back
 * to the kept kind restores it.
 */
export function changeAttributeKind(
	record: AttributeRecord,
	id: string,
	kindId: string,
	engine: AttributeEngine,
): AttributeOperation {
	const attribute = find(record, id);
	if (!attribute) return refuse('unknown_attribute');
	const to = engine.kinds.get(kindId);
	if (!to) return refuse('unknown_kind');
	if (attribute.kind === kindId) return { ok: true, record, attributeId: id };
	if (attribute.previous?.kind === kindId) return restorePreviousValue(record, id, engine);
	const conversion = convertAttributeValue(attribute, to, engine);
	const next: Attribute = {
		id,
		label: attribute.label,
		kind: kindId,
		value: conversion.value,
		config: conversion.config,
	};
	const kept =
		attribute.previous ??
		(conversion.exact ? undefined : { kind: attribute.kind, value: attribute.value, config: attribute.config });
	if (kept) next.previous = kept;
	return done(engine, replace(record, next), id);
}

/** Put the kept value back, with its kind and config. */
export function restorePreviousValue(record: AttributeRecord, id: string, engine: AttributeEngine): AttributeOperation {
	const attribute = find(record, id);
	if (!attribute) return refuse('unknown_attribute');
	if (!attribute.previous) return refuse('no_previous_value');
	const { kind, value, config } = attribute.previous;
	return done(engine, replace(record, { id, label: attribute.label, kind, value, config }), id);
}

/** The user accepted the conversion: forget the kept value. */
export function discardPreviousValue(record: AttributeRecord, id: string, engine: AttributeEngine): AttributeOperation {
	const attribute = find(record, id);
	if (!attribute) return refuse('unknown_attribute');
	if (!attribute.previous) return refuse('no_previous_value');
	const { previous: _dropped, ...rest } = attribute;
	return done(engine, replace(record, rest), id);
}

/** Move an attribute so it ends at `toIndex` of the resulting list. */
export function moveAttribute(
	record: AttributeRecord,
	id: string,
	toIndex: number,
	engine: AttributeEngine,
): AttributeOperation {
	const from = record.attributes.findIndex((a) => a.id === id);
	if (from < 0) return refuse('unknown_attribute');
	if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= record.attributes.length) return refuse('invalid_index');
	if (from === toIndex) return { ok: true, record, attributeId: id };
	const attributes = [...record.attributes];
	const [moved] = attributes.splice(from, 1);
	attributes.splice(toIndex, 0, moved);
	return done(engine, { ...record, attributes }, id);
}

/** Remove an attribute into `removed`. Past `limits.removed`, the oldest removal is forgotten. */
export function removeAttribute(record: AttributeRecord, id: string, engine: AttributeEngine): AttributeOperation {
	const index = record.attributes.findIndex((a) => a.id === id);
	if (index < 0) return refuse('unknown_attribute');
	const attribute = record.attributes[index];
	const removed = [...record.removed, { attribute, index }].slice(-engine.limits.removed);
	return done(engine, { ...record, attributes: record.attributes.filter((a) => a.id !== id), removed }, id);
}

/** Bring a removed attribute back to the place it had (or the end, if the list is now shorter). */
export function restoreAttribute(record: AttributeRecord, id: string, engine: AttributeEngine): AttributeOperation {
	const entry = record.removed.find((r) => r.attribute.id === id);
	if (!entry) return refuse('unknown_attribute');
	if (record.attributes.length >= engine.limits.attributes) return refuse('too_many_attributes');
	const attributes = [...record.attributes];
	attributes.splice(Math.min(entry.index, attributes.length), 0, entry.attribute);
	return done(engine, { ...record, attributes, removed: record.removed.filter((r) => r.attribute.id !== id) }, id);
}
