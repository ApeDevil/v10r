import { describe, expect, it } from 'vitest';
import { parseAttributeRecord, parseAttributeRecordText, serializeAttributeRecord } from './codec.ts';
import type { JsonObject } from './json.ts';
import { coreAttributeKinds, createAttributeKindRegistry, textKind } from './kinds.ts';
import { DEFAULT_ATTRIBUTE_LIMITS } from './limits.ts';

const kinds = coreAttributeKinds;
const attr = (over: Record<string, unknown> = {}) => ({
	id: 'att_0123456789',
	label: 'Species',
	kind: 'text',
	value: 'Human',
	config: {},
	...over,
});
const doc = (attributes: unknown[], removed: unknown[] = []) => ({ format: 1, attributes, removed });
const codes = (input: unknown, options = {}) => {
	const result = parseAttributeRecord(input, { kinds, ...options });
	return result.ok ? [] : result.problems.map((p) => p.code);
};

describe('attribute record codec', () => {
	it('round-trips to canonical bytes, whatever the key order it was given in', () => {
		const shuffled = {
			removed: [],
			attributes: [{ config: {}, value: 32, kind: 'number', label: 'Age', id: 'att_aaaaaaaaaa' }, attr()],
			format: 1,
		};
		const parsed = parseAttributeRecord(shuffled, { kinds });
		if (!parsed.ok) throw new Error('refused');
		const text = serializeAttributeRecord(parsed.record);
		expect(text).toBe(
			'{"attributes":[{"config":{},"id":"att_aaaaaaaaaa","kind":"number","label":"Age","value":32},' +
				'{"config":{},"id":"att_0123456789","kind":"text","label":"Species","value":"Human"}],"format":1,"removed":[]}',
		);
		const again = parseAttributeRecordText(text, { kinds });
		expect(again.ok && serializeAttributeRecord(again.record)).toBe(text);
	});

	it('accepts an empty record', () => {
		expect(parseAttributeRecord(doc([]), { kinds })).toEqual({ ok: true, record: doc([]) });
	});

	it('keeps an attribute of an unknown kind exactly, and refuses one that is not bounded JSON', () => {
		const future = attr({ kind: 'app.rating', value: { stars: 4, scale: [1, 5] }, config: { icon: 'star' } });
		const parsed = parseAttributeRecord(doc([future]), { kinds });
		expect(parsed).toEqual({ ok: true, record: doc([future]) });
		let deep: unknown = 'x';
		for (let i = 0; i < 8; i++) deep = [deep];
		expect(codes(doc([attr({ kind: 'app.rating', value: deep })]))).toEqual(['invalid_opaque']);
		for (let i = 0; i < 20; i++) deep = [deep];
		// Deeper than any record can be: refused by the first, whole-payload copy.
		expect(codes(doc([attr({ kind: 'app.rating', value: deep })]))).toEqual(['invalid_shape']);
	});

	it('refuses prototype-pollution keys and leaves Object.prototype alone', () => {
		const text =
			'{"format":1,"removed":[],"attributes":[{"id":"att_0123456789","label":"x","kind":"app.x","value":{"__proto__":{"polluted":true}},"config":{}}]}';
		expect(parseAttributeRecordText(text, { kinds }).ok).toBe(false);
		const top = JSON.parse('{"format":1,"attributes":[],"removed":[],"__proto__":{"polluted":true}}');
		expect(codes(top)).toEqual(['invalid_shape']);
		const constructorKey = doc([attr({ kind: 'app.x', value: { constructor: { prototype: { polluted: true } } } })]);
		expect(codes(constructorKey)).toEqual(['invalid_shape']);
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
	});

	it('refuses malformed and hostile payloads with a reason, never by throwing', () => {
		const cases: [unknown, string][] = [
			[null, 'invalid_shape'],
			[[], 'invalid_shape'],
			['{}', 'invalid_shape'],
			[{ format: 1, attributes: [] }, 'invalid_shape'],
			[{ ...doc([]), extra: true }, 'invalid_shape'],
			[doc([attr({ id: 'Species' })]), 'invalid_shape'],
			[doc([attr(), attr()]), 'duplicate_id'],
			[doc([attr()], [{ attribute: attr(), index: 0 }]), 'duplicate_id'],
			[doc([attr({ label: 'a\u0000b' })]), 'invalid_shape'],
			[doc([attr({ label: 'a\u0007b' })]), 'invalid_label'],
			[doc([attr({ label: 'x'.repeat(121) })]), 'invalid_label'],
			[doc([attr({ kind: 'Text<script>' })]), 'invalid_shape'],
			[doc([attr({ value: 42 })]), 'invalid_value'],
			[doc([attr({ kind: 'number', value: '42' })]), 'invalid_value'],
			[doc([attr({ kind: 'date', value: '2024-02-30' })]), 'invalid_value'],
			[doc([attr({ kind: 'number', value: 1, config: { min: 5, max: 1 } })]), 'invalid_config'],
			[
				doc([attr({ kind: 'select', value: null, config: { options: [{ id: 'a', label: 'A', onclick: 'x' }] } })]),
				'invalid_config',
			],
			[doc([attr({ config: { pattern: '(a+)+$' } })]), 'invalid_config'],
			[doc([attr({ handler: 'alert(1)' })]), 'invalid_shape'],
			[{ format: 1.5, attributes: [], removed: [] }, 'invalid_format'],
		];
		for (const [input, code] of cases) expect(codes(input), JSON.stringify(input).slice(0, 80)).toContain(code);
		expect(parseAttributeRecordText('{"format":1,', { kinds })).toMatchObject({
			ok: false,
			problems: [{ code: 'invalid_json' }],
		});
	});

	it('enforces resource bounds before walking the payload', () => {
		const many = doc(Array.from({ length: 201 }, (_, i) => attr({ id: `att_${i.toString(16).padStart(10, '0')}` })));
		expect(codes(many)).toEqual(['too_many_attributes']);
		const huge = 'x'.repeat(DEFAULT_ATTRIBUTE_LIMITS.recordBytes + 1);
		expect(parseAttributeRecordText(huge, { kinds })).toMatchObject({ ok: false, problems: [{ code: 'too_large' }] });
		const multi = 'é'.repeat(DEFAULT_ATTRIBUTE_LIMITS.multilineLength);
		const big = doc(
			Array.from({ length: 10 }, (_, i) =>
				attr({ id: `att_${i.toString(16).padStart(10, '0')}`, kind: 'multiline', value: multi }),
			),
		);
		expect(codes(big)).toEqual(['too_large']); // 10 × 40 kB of UTF-8 > 256 kB
	});

	it('refuses a record from a newer format instead of reading part of it', () => {
		expect(codes({ format: 2, attributes: [], removed: [] })).toEqual(['newer_format']);
	});

	it('upgrades an older format through pure upcasters, in order', () => {
		// Simulate a build that writes format 2, where format 1 had no `removed` list.
		const upcasters = { 1: (d: JsonObject) => ({ ...d, format: 2, removed: [] }) };
		const parsed = parseAttributeRecord({ format: 1, attributes: [attr()] }, { kinds, format: 2, upcasters });
		expect(parsed).toEqual({ ok: true, record: doc([attr()]) });
		expect(codes({ format: 1, attributes: [] }, { format: 3, upcasters })).toEqual(['invalid_format']);
	});

	it('returns a record that shares no objects with its input', () => {
		const input = doc([attr({ kind: 'list', value: ['a'] })]);
		const parsed = parseAttributeRecord(input, { kinds });
		if (!parsed.ok) throw new Error('refused');
		(input.attributes[0] as { value: string[] }).value.push('mutated');
		expect(parsed.record.attributes[0].value).toEqual(['a']);
	});

	it('lets an application register its own kinds, and refuses a second registration of an id', () => {
		const color = {
			...textKind,
			id: 'app.color',
			accepts: (value: unknown) => typeof value === 'string' && /^#[0-9a-f]{6}$/.test(value),
			empty: () => '#000000',
		};
		const appKinds = createAttributeKindRegistry([textKind, color]);
		expect(parseAttributeRecord(doc([attr({ kind: 'app.color', value: '#ff8800' })]), { kinds: appKinds }).ok).toBe(
			true,
		);
		expect(parseAttributeRecord(doc([attr({ kind: 'app.color', value: 'red' })]), { kinds: appKinds }).ok).toBe(false);
		expect(() => createAttributeKindRegistry([textKind, textKind])).toThrow(/twice/);
		expect(() => createAttributeKindRegistry([{ ...textKind, id: '__proto__' }])).toThrow(/Invalid/);
	});
});
