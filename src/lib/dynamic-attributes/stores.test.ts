import { describe, expect, it } from 'vitest';
import { coreAttributeKinds } from './kinds.ts';
import { addAttribute, createAttributeEngine, setAttributeValue } from './operations.ts';
import { emptyAttributeRecord } from './record.ts';
import { AttributeRecordLoadError, createKeyValueRecordStore, memoryStorage } from './stores.ts';

const codec = { kinds: coreAttributeKinds };
const engine = createAttributeEngine(coreAttributeKinds);

describe('key-value record store', () => {
	it('starts empty, saves, and restores the same record after a reload', async () => {
		const storage = memoryStorage();
		const store = createKeyValueRecordStore(() => storage, 'rec', codec);
		expect(await store.load()).toEqual({ record: emptyAttributeRecord(), version: 0 });
		const added = addAttribute(emptyAttributeRecord(), { label: 'Ship', kind: 'text' }, engine);
		if (!added.ok) throw new Error();
		const valued = setAttributeValue(added.record, added.attributeId, 'Nautilus', engine);
		if (!valued.ok) throw new Error();
		expect(await store.save(valued.record, 0)).toEqual({ status: 'saved', version: 1 });
		const reloaded = createKeyValueRecordStore(() => storage, 'rec', codec);
		expect(await reloaded.load()).toEqual({ record: valued.record, version: 1 });
	});

	it('refuses a stale save and changes nothing', async () => {
		const storage = memoryStorage();
		const first = createKeyValueRecordStore(() => storage, 'rec', codec);
		const second = createKeyValueRecordStore(() => storage, 'rec', codec);
		const a = addAttribute(emptyAttributeRecord(), { label: 'from A' }, engine);
		const b = addAttribute(emptyAttributeRecord(), { label: 'from B' }, engine);
		if (!a.ok || !b.ok) throw new Error();
		expect(await first.save(a.record, 0)).toEqual({ status: 'saved', version: 1 });
		expect(await second.save(b.record, 0)).toEqual({ status: 'conflict' });
		expect((await second.load()).record).toEqual(a.record);
	});

	it('refuses to open — and never overwrites — a corrupted or hostile stored value', async () => {
		for (const stored of [
			'not json',
			'{"version":-1,"record":{}}',
			'{"version":1,"record":{"format":9,"attributes":[],"removed":[]}}',
		]) {
			const storage = memoryStorage();
			storage.setItem('rec', stored);
			const store = createKeyValueRecordStore(() => storage, 'rec', codec);
			await expect(store.load()).rejects.toBeInstanceOf(AttributeRecordLoadError);
			await expect(store.save(emptyAttributeRecord(), 1)).rejects.toBeInstanceOf(AttributeRecordLoadError);
			expect(storage.getItem('rec')).toBe(stored);
		}
	});

	it('refuses to save a record the codec refuses', async () => {
		const store = createKeyValueRecordStore(memoryStorage, 'rec', codec);
		const bad = { ...emptyAttributeRecord(), attributes: [{ id: 'x', label: '', kind: 'text', value: 1, config: {} }] };
		await expect(store.save(bad, 0)).rejects.toBeInstanceOf(AttributeRecordLoadError);
	});
});
