import { describe, expect, it } from 'vitest';
import {
	checkProjectionImpact,
	checkRecordBindings,
	createAttributeEngine,
	memoryStorage,
	parseAttributeDictionary,
	parseAttributeProjection,
	parseAttributeRecord,
	projectRecord,
	serializeAttributeDictionary,
	syncRecordToDictionary,
} from '#lib/dynamic-attributes/index.ts';
import { CONSUMERS, loadDictionary, loadPins, PRODUCTS, seedDictionary, seedProduct } from './product-catalog.ts';
import { showcaseKinds } from './showcase-records.ts';

const dictionary = seedDictionary();

describe('the product catalog fixtures', () => {
	it('seeds five revisions that survive their codec', () => {
		expect(dictionary.revisions.map((r) => r.revision)).toEqual([1, 2, 3, 4, 5]);
		const parsed = parseAttributeDictionary(JSON.parse(serializeAttributeDictionary(dictionary)), {
			kinds: showcaseKinds,
		});
		expect(parsed.ok).toBe(true);
	});

	it('has products and consumers that parse', () => {
		for (const product of PRODUCTS)
			expect(parseAttributeRecord(seedProduct(product.id), { kinds: showcaseKinds }).ok).toBe(true);
		for (const consumer of CONSUMERS) expect(parseAttributeProjection(consumer).ok).toBe(true);
	});

	it('projects the lamp three ways', () => {
		const lamp = seedProduct('trail-lamp');
		const [shop, feed, sheet] = CONSUMERS.map((c) => projectRecord(lamp, dictionary, c, showcaseKinds));
		expect(shop.document).toMatchObject({
			title: 'Trail Lamp 300',
			variant: { color: 'Olive' },
			specs: { width_mm: 65, weight_g: 180 },
		});
		expect(feed.document).toEqual({
			item_name: 'Trail Lamp 300',
			color_code: 'OLV',
			width_cm: '6.5',
			weight_kg: '0.18',
			waterproof: 'true',
			bullet_points: '300 lumen | USB-C charging | Red night light',
		});
		expect(sheet.text).toContain('Breite: 6.5 cm');
		expect(sheet.text).toContain('Farbe: OLIVE');
	});

	it('warns the feed that its width column would switch to mm', () => {
		const impact = checkProjectionImpact(dictionary, CONSUMERS[1]);
		expect(impact.find((i) => i.code === 'unit_changed')).toMatchObject({ field: 'width_cm', severity: 'warning' });
	});

	it('syncs the lamp to revision 5, converting its width', () => {
		const lamp = seedProduct('trail-lamp');
		expect(checkRecordBindings(lamp, dictionary).filter((f) => f.code === 'stale_binding')).toHaveLength(2);
		const synced = syncRecordToDictionary(lamp, dictionary, createAttributeEngine(showcaseKinds));
		expect(synced.record.attributes.find((a) => a.label === 'Width')?.value).toBe(65);
		expect(synced.record.attributes.find((a) => a.binding?.definition === 'def_0000000005')?.label).toBe('Color');
		expect(checkRecordBindings(synced.record, dictionary)).toEqual([]);
	});

	it('loads a refused dictionary as null and falls back to seed pins', () => {
		const storage = memoryStorage();
		expect(loadDictionary(storage)?.revisions).toHaveLength(5);
		storage.setItem('v10r:showcase:dynamic-attributes:dictionary', '{"format":1,"__proto__":{}}');
		expect(loadDictionary(storage)).toBeNull();
		storage.setItem('v10r:showcase:dynamic-attributes:pins', '{"webshop":99,"marketplace-feed":2}');
		expect(loadPins(storage, 5)).toEqual({ webshop: 5, 'marketplace-feed': 2, 'print-datasheet': 3 });
	});
});
