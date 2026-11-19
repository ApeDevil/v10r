/**
 * The showcase's second half: one product source, three consumers. An attribute dictionary of
 * outdoor products with a five-revision history, three product records bound to it (and one
 * local attribute each, which no consumer sees), and three projections — a German webshop
 * (nested JSON, pinned to the latest revision), an English marketplace feed (flat rows, still
 * pinned to revision 1) and a German print datasheet (text, pinned to revision 3).
 *
 * Everything lives in this browser. The dictionary and the pins go through their codecs on every
 * load, like records do, so a tampered localStorage entry is refused, not rendered.
 */
import {
	type Attribute,
	type AttributeDefinition,
	type AttributeDictionary,
	type AttributeProjection,
	type AttributeRecord,
	type AttributeRecordStore,
	createDictionaryEngine,
	createKeyValueRecordStore,
	type DictionaryChange,
	type JsonObject,
	type JsonValue,
	type KeyValueStorage,
	parseAttributeDictionaryText,
	parseAttributeRecord,
	reviseDictionary,
	type StoredRecordVersion,
	serializeAttributeDictionary,
} from '#lib/dynamic-attributes/index.ts';
import { showcaseKinds } from './showcase-records.ts';

const PREFIX = 'v10r:showcase:dynamic-attributes';
export const CATALOG_DICTIONARY_KEY = `${PREFIX}:dictionary`;
export const CATALOG_PINS_KEY = `${PREFIX}:pins`;
export const CATALOG_DRAFT_NAMESPACE = 'record-showcase-catalog';
/** Every key the catalog writes, for the reset button. */
export function catalogKeys(): string[] {
	return [CATALOG_DICTIONARY_KEY, CATALOG_PINS_KEY, ...PRODUCTS.flatMap((p) => [productKey(p.id), versionsKey(p.id)])];
}

/** Stored record versions kept per product for value history. */
const VERSIONS_KEPT = 30;

export const DEFINITION = {
	name: 'def_0000000001',
	description: 'def_0000000002',
	width: 'def_0000000003',
	weight: 'def_0000000004',
	colour: 'def_0000000005',
	waterproof: 'def_0000000006',
	features: 'def_0000000007',
	release: 'def_0000000008',
} as const;

const COLOUR_OPTIONS = {
	options: [
		{ id: 'black', label: 'Black' },
		{ id: 'sand', label: 'Sand' },
		{ id: 'olive', label: 'Olive' },
	],
};

const FIRST_REVISION: AttributeDefinition[] = [
	{ id: DEFINITION.name, kind: 'text', config: {}, labels: { en: 'Name', de: 'Name' }, status: 'active' },
	{
		id: DEFINITION.description,
		kind: 'multiline',
		config: {},
		labels: { en: 'Description', de: 'Beschreibung' },
		status: 'active',
	},
	{
		id: DEFINITION.width,
		kind: 'number',
		config: { min: 0 },
		unit: 'cm',
		labels: { en: 'Width', de: 'Breite' },
		status: 'active',
	},
	{
		id: DEFINITION.weight,
		kind: 'number',
		config: { min: 0 },
		unit: 'g',
		labels: { en: 'Weight', de: 'Gewicht' },
		status: 'active',
	},
	{
		id: DEFINITION.colour,
		kind: 'select',
		config: COLOUR_OPTIONS,
		labels: { en: 'Colour', de: 'Farbe' },
		status: 'active',
	},
	{
		id: DEFINITION.waterproof,
		kind: 'boolean',
		config: {},
		labels: { en: 'Waterproof', de: 'Wasserdicht' },
		status: 'active',
	},
	{ id: DEFINITION.features, kind: 'list', config: {}, labels: { en: 'Features', de: 'Merkmale' }, status: 'active' },
];

/** Ids for definitions added in the demo: deterministic in the seed, random afterwards. */
function seedIds(ids: string[]): () => string {
	let i = 0;
	return () => ids[i++] ?? `def_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

export function createCatalogDictionaryEngine(createId?: () => string) {
	return createDictionaryEngine(showcaseKinds, createId ? { createId } : {});
}

/** Revisions 2–5, written through `reviseDictionary` exactly as an edit in the page would be. */
const HISTORY: { change: DictionaryChange; note: string }[] = [
	{
		change: { op: 'relabel', definition: DEFINITION.colour, locale: 'en', label: 'Color' },
		note: 'US spelling, as the shop uses',
	},
	{ change: { op: 'add', kind: 'date', label: 'Release date' }, note: 'Added the release date' },
	{
		change: { op: 'relabel', definition: DEFINITION.release, locale: 'de', label: 'Erscheinungsdatum' },
		note: 'German label for the release date',
	},
	{
		change: { op: 'set_unit', definition: DEFINITION.width, unit: 'mm' },
		note: 'Widths are measured in mm from now on',
	},
];

export function seedDictionary(): AttributeDictionary {
	let dictionary: AttributeDictionary = {
		format: 1,
		sourceLocale: 'en',
		revisions: [{ revision: 1, note: 'First product attributes', definitions: FIRST_REVISION }],
	};
	const engine = createCatalogDictionaryEngine(seedIds([DEFINITION.release]));
	for (const { change, note } of HISTORY) {
		const revised = reviseDictionary(dictionary, change, note, engine);
		if (!revised.ok) throw new Error(`Seed revision refused: ${revised.refusal}`);
		dictionary = revised.dictionary;
	}
	return dictionary;
}

export interface CatalogProduct {
	id: string;
	name: string;
}

export const PRODUCTS: readonly CatalogProduct[] = [
	{ id: 'trail-lamp', name: 'Trail Lamp 300' },
	{ id: 'camp-stove', name: 'Ember Camp Stove' },
	{ id: 'daypack', name: 'Ridge Daypack 22' },
];

function bound(
	attribute: string,
	definition: string,
	revision: number,
	label: string,
	kind: string,
	value: JsonValue,
	config: JsonObject = {},
): Attribute {
	return { id: attribute, label, kind, value, config, binding: { definition, revision } };
}

/**
 * The seed records. The lamp and the stove were written at revision 1 (widths in cm, "Colour");
 * the daypack at revision 5 (width in mm, "Color", a release date). Syncing the first two to the
 * dictionary is one of the things to try.
 */
export function seedProduct(id: string): AttributeRecord {
	const r1 = (
		attribute: string,
		definition: string,
		label: string,
		kind: string,
		value: JsonValue,
		config: JsonObject = {},
	) => bound(attribute, definition, 1, label, kind, value, config);
	switch (id) {
		case 'trail-lamp':
			return {
				format: 1,
				removed: [],
				attributes: [
					r1('att_00000001a1', DEFINITION.name, 'Name', 'text', 'Trail Lamp 300'),
					r1(
						'att_00000001a2',
						DEFINITION.description,
						'Description',
						'multiline',
						'A 300-lumen head lamp for night hikes.',
					),
					r1('att_00000001a3', DEFINITION.width, 'Width', 'number', 6.5, { min: 0 }),
					r1('att_00000001a4', DEFINITION.weight, 'Weight', 'number', 180, { min: 0 }),
					r1('att_00000001a5', DEFINITION.colour, 'Colour', 'select', 'olive', COLOUR_OPTIONS),
					r1('att_00000001a6', DEFINITION.waterproof, 'Waterproof', 'boolean', true),
					r1('att_00000001a7', DEFINITION.features, 'Features', 'list', [
						'300 lumen',
						'USB-C charging',
						'Red night light',
					]),
					{ id: 'att_00000001a8', label: 'Buyer note', kind: 'text', value: 'Reorder before October', config: {} },
				],
			};
		case 'camp-stove':
			return {
				format: 1,
				removed: [],
				attributes: [
					r1('att_00000002a1', DEFINITION.name, 'Name', 'text', 'Ember Camp Stove'),
					r1(
						'att_00000002a2',
						DEFINITION.description,
						'Description',
						'multiline',
						'A folding gas stove that boils a litre in four minutes.',
					),
					r1('att_00000002a3', DEFINITION.width, 'Width', 'number', 14, { min: 0 }),
					r1('att_00000002a4', DEFINITION.weight, 'Weight', 'number', 410, { min: 0 }),
					r1('att_00000002a5', DEFINITION.colour, 'Colour', 'select', 'sand', COLOUR_OPTIONS),
					r1('att_00000002a6', DEFINITION.waterproof, 'Waterproof', 'boolean', false),
					r1('att_00000002a7', DEFINITION.features, 'Features', 'list', ['Piezo ignition', 'Wind shield']),
					{ id: 'att_00000002a8', label: 'Supplier', kind: 'text', value: 'Nordflame GmbH', config: {} },
				],
			};
		default:
			return {
				format: 1,
				removed: [],
				attributes: [
					bound('att_00000003a1', DEFINITION.name, 5, 'Name', 'text', 'Ridge Daypack 22'),
					bound(
						'att_00000003a2',
						DEFINITION.description,
						5,
						'Description',
						'multiline',
						'A 22-litre pack with a back panel that breathes.',
					),
					bound('att_00000003a3', DEFINITION.width, 5, 'Width', 'number', 280, { min: 0 }),
					bound('att_00000003a4', DEFINITION.weight, 5, 'Weight', 'number', 950, { min: 0 }),
					bound('att_00000003a5', DEFINITION.colour, 5, 'Color', 'select', 'black', COLOUR_OPTIONS),
					bound('att_00000003a6', DEFINITION.waterproof, 5, 'Waterproof', 'boolean', true),
					bound('att_00000003a7', DEFINITION.features, 5, 'Features', 'list', ['Rain cover', 'Hip belt pockets']),
					bound('att_00000003a8', DEFINITION.release, 5, 'Release date', 'date', '2026-03-01'),
					{ id: 'att_00000003a9', label: 'Shelf', kind: 'text', value: 'B-14', config: {} },
				],
			};
	}
}

/** The three consumers, each in its seed pin. */
export const CONSUMERS: readonly AttributeProjection[] = [
	{
		format: 1,
		consumer: 'webshop',
		name: 'Webshop (DE)',
		locale: 'de',
		dictionaryRevision: 5,
		output: 'object',
		fields: [
			{ from: DEFINITION.name, as: 'title', render: { display: 'heading' } },
			{ from: DEFINITION.description, as: 'description' },
			{ from: DEFINITION.colour, as: 'variant.color', render: { display: 'badge' } },
			{ from: DEFINITION.width, as: 'specs.width_mm', render: { group: 'Technische Daten' } },
			{ from: DEFINITION.weight, as: 'specs.weight_g', render: { group: 'Technische Daten' } },
			{ from: DEFINITION.waterproof, as: 'specs.waterproof', render: { group: 'Technische Daten' } },
			{ from: DEFINITION.features, as: 'highlights', render: { display: 'list' } },
			{ from: DEFINITION.release, as: 'availableFrom', render: { emphasis: 'muted' } },
		],
	},
	{
		format: 1,
		consumer: 'marketplace-feed',
		name: 'Marketplace feed (EN)',
		locale: 'en',
		dictionaryRevision: 1,
		output: 'row',
		fields: [
			{ from: DEFINITION.name, as: 'item_name' },
			{
				from: DEFINITION.colour,
				as: 'color_code',
				label: 'Color code',
				steps: [{ op: 'map_options', map: { black: 'BLK', sand: 'SND', olive: 'OLV' } }],
			},
			{ from: DEFINITION.width, as: 'width_cm', steps: [{ op: 'round', decimals: 1 }] },
			{
				from: DEFINITION.weight,
				as: 'weight_kg',
				label: 'Weight (kg)',
				steps: [
					{ op: 'convert_unit', to: 'kg' },
					{ op: 'round', decimals: 2 },
				],
			},
			{ from: DEFINITION.waterproof, as: 'waterproof' },
			{ from: DEFINITION.features, as: 'bullet_points', steps: [{ op: 'join', separator: ' | ' }] },
		],
	},
	{
		format: 1,
		consumer: 'print-datasheet',
		name: 'Print datasheet (DE)',
		locale: 'de',
		dictionaryRevision: 3,
		output: 'text',
		fields: [
			{ from: DEFINITION.name, as: 'name', label: 'Produkt' },
			{ from: DEFINITION.width, as: 'width', steps: [{ op: 'with_unit' }] },
			{ from: DEFINITION.weight, as: 'weight', steps: [{ op: 'with_unit' }] },
			{ from: DEFINITION.colour, as: 'colour', steps: [{ op: 'change_case', mode: 'upper' }] },
			{ from: DEFINITION.features, as: 'features', steps: [{ op: 'join', separator: ', ' }] },
			{ from: DEFINITION.release, as: 'release' },
		],
	},
];

// ── Browser storage ───────────────────────────────────────────────────────────────────────

export function productKey(id: string): string {
	return `${PREFIX}:product:${id}`;
}

function versionsKey(id: string): string {
	return `${PREFIX}:product:${id}:versions`;
}

/** The stored dictionary, the seed on first visit, or null when what is stored is refused. */
export function loadDictionary(storage: KeyValueStorage): AttributeDictionary | null {
	const text = storage.getItem(CATALOG_DICTIONARY_KEY);
	if (text === null) {
		const seed = seedDictionary();
		storage.setItem(CATALOG_DICTIONARY_KEY, serializeAttributeDictionary(seed));
		return seed;
	}
	const parsed = parseAttributeDictionaryText(text, { kinds: showcaseKinds });
	return parsed.ok ? parsed.dictionary : null;
}

export function saveDictionary(storage: KeyValueStorage, dictionary: AttributeDictionary): void {
	storage.setItem(CATALOG_DICTIONARY_KEY, serializeAttributeDictionary(dictionary));
}

/** Each consumer's pin; seed pins for any consumer missing or malformed. */
export function loadPins(storage: KeyValueStorage, latest: number): Record<string, number> {
	const pins: Record<string, number> = Object.fromEntries(CONSUMERS.map((c) => [c.consumer, c.dictionaryRevision]));
	try {
		const stored = JSON.parse(storage.getItem(CATALOG_PINS_KEY) ?? '{}') as unknown;
		if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
			for (const consumer of Object.keys(pins)) {
				const pin = (stored as Record<string, unknown>)[consumer];
				if (typeof pin === 'number' && Number.isInteger(pin) && pin >= 1 && pin <= latest) pins[consumer] = pin;
			}
		}
	} catch {
		// A malformed pin file falls back to the seed pins.
	}
	return pins;
}

export function savePins(storage: KeyValueStorage, pins: Record<string, number>): void {
	storage.setItem(CATALOG_PINS_KEY, JSON.stringify(pins));
}

/** Stored versions of one product, oldest first, each re-parsed; a refused entry is skipped. */
export function loadVersions(storage: KeyValueStorage, id: string): StoredRecordVersion[] {
	try {
		const raw = JSON.parse(storage.getItem(versionsKey(id)) ?? '[]') as unknown;
		if (!Array.isArray(raw)) return [];
		return raw.flatMap((entry): StoredRecordVersion[] => {
			if (!entry || typeof entry !== 'object') return [];
			const { version, savedAt, record } = entry as Record<string, unknown>;
			if (typeof version !== 'number' || typeof savedAt !== 'string') return [];
			const parsed = parseAttributeRecord(record, { kinds: showcaseKinds });
			return parsed.ok ? [{ version, savedAt, record: parsed.record }] : [];
		});
	} catch {
		return [];
	}
}

function appendVersion(storage: KeyValueStorage, id: string, version: StoredRecordVersion): void {
	const versions = [...loadVersions(storage, id), version].slice(-VERSIONS_KEPT);
	storage.setItem(versionsKey(id), JSON.stringify(versions));
}

/**
 * A product's store: the record store every showcase record uses, plus a log of each accepted
 * save — the stand-in for the desk's `file_revision` table that value history reads.
 */
export function createProductStore(
	storage: () => Storage,
	id: string,
	now: () => Date = () => new Date(),
): AttributeRecordStore {
	const store = createKeyValueRecordStore(storage, productKey(id), { kinds: showcaseKinds });
	return {
		async load() {
			const snapshot = await store.load();
			if (loadVersions(storage(), id).length === 0) {
				appendVersion(storage(), id, {
					version: snapshot.version,
					savedAt: now().toISOString(),
					record: snapshot.record,
				});
			}
			return snapshot;
		},
		async save(record, expectedVersion) {
			const result = await store.save(record, expectedVersion);
			if (result.status === 'saved') {
				appendVersion(storage(), id, { version: result.version, savedAt: now().toISOString(), record });
			}
			return result;
		},
	};
}

/** Write the seed record of every product not stored yet. */
export function seedProducts(storage: KeyValueStorage): void {
	for (const product of PRODUCTS) {
		if (storage.getItem(productKey(product.id)) === null) {
			storage.setItem(productKey(product.id), JSON.stringify({ record: seedProduct(product.id), version: 0 }));
		}
	}
}
