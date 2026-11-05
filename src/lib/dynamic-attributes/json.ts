/**
 * JSON values as the record stores them, and the one door untrusted JSON comes through.
 *
 * Everything a record holds is plain JSON — no `Date`, no `Map`, no class — so the in-memory
 * shape, the serialized text and a PostgreSQL `jsonb` column are the same tree. An attribute of
 * an unknown kind is kept as opaque JSON, which is why that JSON is copied, not trusted: the
 * copy has fresh plain prototypes, refuses the keys a later `obj[key] = …` could turn into
 * prototype pollution, and is bounded in depth, breadth and string length before anything walks it.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/** Keys that address an object's prototype chain when assigned with bracket notation. */
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * PostgreSQL `jsonb` refuses U+0000 in a string, and no person types it: a record holding it
 * would validate in the browser and fail at the database. Refused everywhere, up front.
 */
const NUL = '\u0000';

export interface JsonBounds {
	/** Containers deep, the root counting as 1. */
	depth: number;
	/** Array items plus object keys, summed over the whole tree. */
	entries: number;
	/** Longest string, key or value, in UTF-16 code units. */
	stringLength: number;
}

export type JsonCopy = { ok: true; value: JsonValue } | { ok: false; reason: string };

export function isReservedKey(key: string): boolean {
	return RESERVED_KEYS.has(key);
}

export function hasNul(text: string): boolean {
	return text.includes(NUL);
}

/** A plain-JSON copy of `input`, or why it is not plain, bounded JSON. Never throws. */
export function copyBoundedJson(input: unknown, bounds: JsonBounds): JsonCopy {
	let entries = 0;
	const fail = (reason: string): JsonCopy => ({ ok: false, reason });

	const visit = (node: unknown, depth: number): JsonCopy => {
		if (node === null || typeof node === 'boolean') return { ok: true, value: node };
		if (typeof node === 'number')
			return Number.isFinite(node) ? { ok: true, value: node } : fail('not a finite number');
		if (typeof node === 'string') {
			if (node.length > bounds.stringLength) return fail('string too long');
			if (hasNul(node)) return fail('string holds U+0000');
			return { ok: true, value: node };
		}
		if (typeof node !== 'object') return fail(`not JSON (${typeof node})`);
		if (depth > bounds.depth) return fail('nested too deep');
		if (Array.isArray(node)) {
			entries += node.length;
			if (entries > bounds.entries) return fail('too many entries');
			const out: JsonValue[] = [];
			for (const item of node) {
				const copied = visit(item, depth + 1);
				if (!copied.ok) return copied;
				out.push(copied.value);
			}
			return { ok: true, value: out };
		}
		const proto = Object.getPrototypeOf(node);
		if (proto !== Object.prototype && proto !== null) return fail('not a plain object');
		const keys = Object.keys(node);
		entries += keys.length;
		if (entries > bounds.entries) return fail('too many entries');
		const out: JsonObject = {};
		for (const key of keys) {
			if (isReservedKey(key)) return fail(`reserved key "${key}"`);
			if (key.length > bounds.stringLength || hasNul(key)) return fail('invalid key');
			const copied = visit((node as Record<string, unknown>)[key], depth + 1);
			if (!copied.ok) return copied;
			out[key] = copied.value;
		}
		return { ok: true, value: out };
	};

	return visit(input, 1);
}

/** Byte length of `text` as UTF-8 — the unit storage and transport limits are stated in. */
export function utf8Length(text: string): number {
	let bytes = 0;
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);
		if (code < 0x80) bytes += 1;
		else if (code < 0x800) bytes += 2;
		else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
			const next = text.charCodeAt(i + 1);
			if (next >= 0xdc00 && next <= 0xdfff) {
				bytes += 4;
				i++;
			} else bytes += 3;
		} else bytes += 3;
	}
	return bytes;
}

/**
 * Canonical JSON text: object keys sorted, no whitespace. Two equal records serialize to the
 * same bytes whichever editor, server or JSONB round trip produced them — `jsonb` itself
 * reorders keys (shorter first), so stored key order can never be the canonical one.
 */
export function canonicalJson(value: JsonValue): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
	// An `undefined` property is absent in JSON; skipping it keeps `{ a: undefined }` equal to `{}`.
	const keys = Object.keys(value)
		.filter((key) => value[key] !== undefined)
		.sort();
	return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

/** Structural equality over plain JSON. */
export function jsonEqual(a: JsonValue | undefined, b: JsonValue | undefined): boolean {
	if (a === b) return true;
	if (a === undefined || b === undefined) return false;
	return canonicalJson(a) === canonicalJson(b);
}
