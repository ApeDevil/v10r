import { describe, expect, it } from 'vitest';
import {
	type AttributeDictionary,
	bindAttribute,
	checkRecordBindings,
	coreAttributeKinds,
	createAttributeEngine,
	createDictionaryEngine,
	diffDictionaryRevisions,
	emptyAttributeRecord,
	latestRevision,
	parseAttributeDictionary,
	parseAttributeRecord,
	promoteAttribute,
	relabelAttribute,
	reviseDictionary,
	serializeAttributeDictionary,
	setAttributeValue,
	syncRecordToDictionary,
	unbindAttribute,
} from './index.ts';

const ids = (list: string[]) => {
	let i = 0;
	return () => list[i++];
};
const engine = createAttributeEngine(coreAttributeKinds, {
	createId: ids(['att_000000000a', 'att_000000000b', 'att_000000000c']),
});
const dictionaryEngine = () =>
	createDictionaryEngine(coreAttributeKinds, { createId: ids(['def_00000000aa', 'def_00000000bb']) });

const base: AttributeDictionary = {
	format: 1,
	sourceLocale: 'en',
	revisions: [
		{
			revision: 1,
			note: 'First',
			definitions: [
				{
					id: 'def_0000000001',
					kind: 'number',
					config: {},
					unit: 'cm',
					labels: { en: 'Width', de: 'Breite' },
					status: 'active',
				},
				{ id: 'def_0000000002', kind: 'text', config: {}, labels: { en: 'Name' }, status: 'active' },
			],
		},
	],
};

describe('reviseDictionary', () => {
	it('writes one new revision per change and shares unchanged definitions', () => {
		const revised = reviseDictionary(
			base,
			{ op: 'relabel', definition: 'def_0000000002', locale: 'de', label: 'Name' },
			'',
			dictionaryEngine(),
		);
		expect(revised.ok).toBe(true);
		if (!revised.ok) return;
		expect(revised.revision).toBe(2);
		const [r1, r2] = revised.dictionary.revisions;
		expect(r2.definitions[0]).toBe(r1.definitions[0]);
		expect(r2.definitions[1].labels).toEqual({ en: 'Name', de: 'Name' });
		expect(r2.note).toBe('Relabelled (de) to "Name"');
		expect(base.revisions).toHaveLength(1);
	});

	it('refuses a no-op, a retired definition and clearing the source label', () => {
		const e = dictionaryEngine();
		expect(reviseDictionary(base, { op: 'set_unit', definition: 'def_0000000001', unit: 'cm' }, '', e)).toEqual({
			ok: false,
			refusal: 'unchanged',
		});
		expect(
			reviseDictionary(base, { op: 'relabel', definition: 'def_0000000001', locale: 'en', label: ' ' }, '', e),
		).toEqual({ ok: false, refusal: 'invalid_label' });
		const retired = reviseDictionary(
			base,
			{ op: 'set_status', definition: 'def_0000000002', status: 'retired' },
			'',
			e,
		);
		if (!retired.ok) throw new Error('retire refused');
		expect(
			reviseDictionary(
				retired.dictionary,
				{ op: 'relabel', definition: 'def_0000000002', locale: 'en', label: 'X' },
				'',
				e,
			),
		).toEqual({ ok: false, refusal: 'retired' });
	});

	it('refuses a unit on a non-number', () => {
		expect(
			reviseDictionary(base, { op: 'set_unit', definition: 'def_0000000002', unit: 'kg' }, '', dictionaryEngine()),
		).toEqual({ ok: false, refusal: 'invalid_unit' });
	});

	it('diffs revisions by definition', () => {
		const e = dictionaryEngine();
		const a = reviseDictionary(base, { op: 'set_unit', definition: 'def_0000000001', unit: 'mm' }, '', e);
		if (!a.ok) throw new Error();
		const b = reviseDictionary(a.dictionary, { op: 'add', kind: 'boolean', label: 'Waterproof' }, '', e);
		if (!b.ok) throw new Error();
		expect(diffDictionaryRevisions(b.dictionary, 1, 3).map((c) => [c.definition, c.parts])).toEqual([
			['def_0000000001', ['unit']],
			['def_00000000aa', ['added']],
		]);
	});
});

describe('parseAttributeDictionary', () => {
	it('round-trips through canonical text', () => {
		const parsed = parseAttributeDictionary(JSON.parse(serializeAttributeDictionary(base)), {
			kinds: coreAttributeKinds,
		});
		expect(parsed.ok && serializeAttributeDictionary(parsed.dictionary)).toBe(serializeAttributeDictionary(base));
	});

	it('refuses a definition that disappears, a gap in revisions and an unknown kind', () => {
		const dropped = {
			...base,
			revisions: [...base.revisions, { revision: 2, note: '', definitions: [base.revisions[0].definitions[0]] }],
		};
		const gap = { ...base, revisions: [{ ...base.revisions[0], revision: 2 }] };
		const unknown = {
			...base,
			revisions: [{ ...base.revisions[0], definitions: [{ ...base.revisions[0].definitions[1], kind: 'app.secret' }] }],
		};
		const codes = (input: unknown) => {
			const parsed = parseAttributeDictionary(input, { kinds: coreAttributeKinds });
			return parsed.ok ? [] : parsed.problems.map((p) => p.code);
		};
		expect(codes(dropped)).toContain('dropped_definition');
		expect(codes(gap)).toContain('invalid_revision');
		expect(codes(unknown)).toContain('unknown_kind');
		expect(codes({ ...base, __proto__: { x: 1 } })).toEqual(['invalid_shape']);
		expect(codes(JSON.parse('{"format":1,"sourceLocale":"en","revisions":[],"__proto__":{}}'))).toContain(
			'invalid_shape',
		);
	});
});

describe('bound attributes', () => {
	it('binds, refuses a relabel, syncs a unit change by converting, and unbinds', () => {
		const bound = bindAttribute(emptyAttributeRecord(), base, 'def_0000000001', engine);
		if (!bound.ok) throw new Error(bound.refusal);
		const attribute = bound.record.attributes[0];
		expect(attribute).toMatchObject({
			label: 'Width',
			kind: 'number',
			binding: { definition: 'def_0000000001', revision: 1 },
		});
		expect(bindAttribute(bound.record, base, 'def_0000000001', engine)).toEqual({
			ok: false,
			refusal: 'already_bound',
		});
		expect(relabelAttribute(bound.record, attribute.id, 'Breadth', engine)).toEqual({
			ok: false,
			refusal: 'bound_attribute',
		});

		const valued = setAttributeValue(bound.record, attribute.id, 18, engine);
		if (!valued.ok) throw new Error();
		const mm = reviseDictionary(
			base,
			{ op: 'set_unit', definition: 'def_0000000001', unit: 'mm' },
			'',
			dictionaryEngine(),
		);
		if (!mm.ok) throw new Error();
		expect(checkRecordBindings(valued.record, mm.dictionary).map((f) => f.code)).toEqual(['stale_binding']);
		const synced = syncRecordToDictionary(valued.record, mm.dictionary, engine);
		expect(synced.changes).toEqual([
			{ attributeId: attribute.id, definition: 'def_0000000001', from: 1, to: 2, outcome: 'converted' },
		]);
		expect(synced.record.attributes[0]).toMatchObject({ value: 180, binding: { revision: 2 } });
		expect(checkRecordBindings(synced.record, mm.dictionary)).toEqual([]);
		expect(parseAttributeRecord(synced.record, { kinds: coreAttributeKinds }).ok).toBe(true);

		const local = unbindAttribute(synced.record, attribute.id);
		expect(local.ok && local.record.attributes[0].binding).toBeUndefined();
	});

	it('keeps a lossy value as previous when a definition changes kind', () => {
		const bound = bindAttribute(emptyAttributeRecord(), base, 'def_0000000002', engine);
		if (!bound.ok) throw new Error();
		const valued = setAttributeValue(bound.record, bound.attributeId, 'Kestrel', engine);
		if (!valued.ok) throw new Error();
		const retyped = reviseDictionary(
			base,
			{ op: 'change_kind', definition: 'def_0000000002', kind: 'number' },
			'',
			dictionaryEngine(),
		);
		if (!retyped.ok) throw new Error();
		const synced = syncRecordToDictionary(valued.record, retyped.dictionary, engine);
		expect(synced.changes[0].outcome).toBe('kept_previous');
		expect(synced.record.attributes[0]).toMatchObject({
			kind: 'number',
			value: null,
			previous: { kind: 'text', value: 'Kestrel' },
		});
	});

	it('refuses a record that binds one definition twice', () => {
		const attribute = {
			id: 'att_0000000001',
			label: 'W',
			kind: 'number',
			value: 1,
			config: {},
			binding: { definition: 'def_0000000001', revision: 1 },
		};
		const parsed = parseAttributeRecord(
			{ format: 1, removed: [], attributes: [attribute, { ...attribute, id: 'att_0000000002' }] },
			{ kinds: coreAttributeKinds },
		);
		expect(parsed.ok ? [] : parsed.problems.map((p) => p.code)).toEqual(['duplicate_binding']);
	});

	it('promotes a local attribute into a new definition', () => {
		const record = {
			format: 1 as const,
			removed: [],
			attributes: [{ id: 'att_0000000001', label: 'Battery', kind: 'text', value: 'AA', config: {} }],
		};
		const promoted = promoteAttribute(record, base, 'att_0000000001', dictionaryEngine());
		if (!promoted.ok) throw new Error(promoted.refusal);
		expect(latestRevision(promoted.dictionary).definitions.at(-1)).toMatchObject({
			id: 'def_00000000aa',
			labels: { en: 'Battery' },
		});
		expect(promoted.record.attributes[0]).toMatchObject({
			value: 'AA',
			binding: { definition: 'def_00000000aa', revision: 2 },
		});
	});
});
