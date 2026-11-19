import { describe, expect, it } from 'vitest';
import {
	type AttributeDictionary,
	type AttributeProjection,
	type AttributeRecord,
	checkProjectionImpact,
	coreAttributeKinds,
	createDictionaryEngine,
	parseAttributeProjection,
	projectRecord,
	repinProjection,
	reviseDictionary,
} from './index.ts';

const options = {
	options: [
		{ id: 'black', label: 'Black' },
		{ id: 'olive', label: 'Olive' },
	],
};
const dictionary1: AttributeDictionary = {
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
				{ id: 'def_0000000002', kind: 'select', config: options, labels: { en: 'Colour' }, status: 'active' },
				{ id: 'def_0000000003', kind: 'list', config: {}, labels: { en: 'Features' }, status: 'active' },
			],
		},
	],
};
const engine = createDictionaryEngine(coreAttributeKinds, { createId: () => 'def_00000000aa' });
const revise = (d: AttributeDictionary, change: Parameters<typeof reviseDictionary>[1]) => {
	const r = reviseDictionary(d, change, '', engine);
	if (!r.ok) throw new Error(r.refusal);
	return r.dictionary;
};
// r2: width in mm · r3: Colour → Color · r4: a new option
const dictionary = revise(
	revise(revise(dictionary1, { op: 'set_unit', definition: 'def_0000000001', unit: 'mm' }), {
		op: 'relabel',
		definition: 'def_0000000002',
		locale: 'en',
		label: 'Color',
	}),
	{
		op: 'configure',
		definition: 'def_0000000002',
		config: { options: [...options.options, { id: 'sand', label: 'Sand' }] },
	},
);

const record: AttributeRecord = {
	format: 1,
	removed: [],
	attributes: [
		{
			id: 'att_0000000001',
			label: 'Width',
			kind: 'number',
			value: 6.5,
			config: {},
			binding: { definition: 'def_0000000001', revision: 1 },
		},
		{
			id: 'att_0000000002',
			label: 'Colour',
			kind: 'select',
			value: 'olive',
			config: options,
			binding: { definition: 'def_0000000002', revision: 1 },
		},
		{
			id: 'att_0000000003',
			label: 'Features',
			kind: 'list',
			value: ['USB-C', 'IPX7'],
			config: {},
			binding: { definition: 'def_0000000003', revision: 1 },
		},
		{ id: 'att_0000000004', label: 'Note', kind: 'text', value: 'local only', config: {} },
	],
};

const feed: AttributeProjection = {
	format: 1,
	consumer: 'feed',
	name: 'Feed',
	locale: 'en',
	dictionaryRevision: 1,
	output: 'row',
	fields: [
		{ from: 'def_0000000001', as: 'width_cm' },
		{ from: 'def_0000000002', as: 'color', steps: [{ op: 'map_options', map: { black: 'BLK', olive: 'OLV' } }] },
		{ from: 'def_0000000003', as: 'bullets', steps: [{ op: 'join', separator: ' | ' }] },
	],
};

describe('projectRecord', () => {
	it('renames, maps and joins into a flat row, and leaves local attributes out', () => {
		const out = projectRecord(record, dictionary, feed, coreAttributeKinds);
		expect(out.document).toEqual({ width_cm: '6.5', color: 'OLV', bullets: 'USB-C | IPX7' });
		expect(out.findings).toEqual([]);
	});

	it('nests by path and converts a value written in cm for a consumer pinned to mm', () => {
		const shop: AttributeProjection = {
			...feed,
			locale: 'de',
			dictionaryRevision: 3,
			output: 'object',
			fields: [
				{ from: 'def_0000000001', as: 'specs.width', steps: [{ op: 'with_unit' }] },
				{ from: 'def_0000000002', as: 'variant.color' },
			],
		};
		const out = projectRecord(record, dictionary, shop, coreAttributeKinds);
		expect(out.document).toEqual({ specs: { width: '65 mm' }, variant: { color: 'Olive' } });
		expect(out.fields.map((f) => f.label)).toEqual(['Breite', 'Color']);
	});

	it('reports a missing value and a step that does not apply, without refusing', () => {
		const out = projectRecord(
			{ ...record, attributes: record.attributes.slice(1) },
			dictionary,
			{ ...feed, fields: [feed.fields[0], { from: 'def_0000000003', as: 'x', steps: [{ op: 'round', decimals: 0 }] }] },
			coreAttributeKinds,
		);
		expect(out.findings).toEqual([
			{ code: 'no_value', field: 'width_cm' },
			{ code: 'step_skipped', field: 'x', step: 'round' },
		]);
		expect(out.document.width_cm).toBe('');
	});
});

describe('checkProjectionImpact', () => {
	it('names what moving the pin would change, with severities', () => {
		const impact = checkProjectionImpact(dictionary, feed);
		expect(impact.map((i) => [i.code, i.severity, i.field])).toEqual([
			['unit_changed', 'warning', 'width_cm'],
			['label_changed', 'info', 'color'],
			['options_changed', 'info', 'color'],
			['unmapped_option', 'warning', 'color'],
		]);
		expect(checkProjectionImpact(dictionary, repinProjection(feed, 4))).toEqual([]);
	});
});

describe('parseAttributeProjection', () => {
	it('accepts the feed and refuses colliding paths, unknown steps and smuggled keys', () => {
		expect(parseAttributeProjection(feed).ok).toBe(true);
		const nested = {
			...feed,
			output: 'object',
			fields: [
				{ from: 'def_0000000001', as: 'a' },
				{ from: 'def_0000000002', as: 'a.b' },
			],
		};
		expect(parseAttributeProjection(nested).ok).toBe(false);
		expect(
			parseAttributeProjection({
				...feed,
				fields: [{ from: 'def_0000000001', as: 'x', steps: [{ op: 'eval', code: '1' }] }],
			}).ok,
		).toBe(false);
		expect(
			parseAttributeProjection({ ...feed, fields: [{ from: 'def_0000000001', as: 'x', render: { onRender: 'x' } }] })
				.ok,
		).toBe(false);
	});
});
