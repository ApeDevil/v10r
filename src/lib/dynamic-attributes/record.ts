/**
 * The self-describing record: a document that carries its own structure. Each attribute holds
 * its definition (label, kind, config) beside its value, so a record needs no template, no
 * migration when a user adds a field, and reads the same in any application that knows its kinds.
 *
 * Identity is the attribute `id`, never the label: labels are text a person edits, may repeat,
 * and may be empty while they type. Order is the array order — never object-key order, which
 * PostgreSQL `jsonb` does not keep.
 */
import type { JsonObject, JsonValue } from './json.ts';

/** The persisted shape number. Not `version` (the optimistic-concurrency counter) nor `revision` (a stored snapshot). */
export const ATTRIBUTE_RECORD_FORMAT = 1;

/** What an attribute held before a lossy kind change, kept until the user restores or discards it. */
export interface PreviousAttributeValue {
	kind: string;
	value: JsonValue;
	config: JsonObject;
}

export interface Attribute {
	/** Stable identity: `att_` and 10 lowercase hex. Never shown, never reused. */
	id: string;
	/** What the user calls it. Free text; uniqueness is not required. */
	label: string;
	/** A kind id from the application's registry — or one it does not know, kept as it was. */
	kind: string;
	value: JsonValue;
	/** Kind-specific settings (a number's bounds, a selection's options). `{}` when none. */
	config: JsonObject;
	previous?: PreviousAttributeValue;
}

/** A removed attribute, kept with the place it held so restoring puts it back there. */
export interface RemovedAttribute {
	attribute: Attribute;
	index: number;
}

export interface AttributeRecord {
	format: typeof ATTRIBUTE_RECORD_FORMAT;
	attributes: Attribute[];
	/** Newest last; bounded by `AttributeLimits.removed`. */
	removed: RemovedAttribute[];
}

const ATTRIBUTE_ID = /^att_[0-9a-f]{10}$/;

export function isAttributeId(id: string): boolean {
	return ATTRIBUTE_ID.test(id);
}

/** A fresh attribute id. `random` is injectable so tests and fixtures are deterministic. */
export function createAttributeId(random: () => number = Math.random): string {
	if (random === Math.random && typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return `att_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
	}
	let hex = '';
	for (let i = 0; i < 10; i++) hex += Math.floor(random() * 16).toString(16);
	return `att_${hex}`;
}

export function emptyAttributeRecord(): AttributeRecord {
	return { format: ATTRIBUTE_RECORD_FORMAT, attributes: [], removed: [] };
}
