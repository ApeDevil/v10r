/**
 * The showcase's wiring: the kinds it registers (core + one application kind), the browser
 * store both editors share, and payloads that show what the codec refuses. Everything runs in
 * the browser — the server-backed version of the same editor is the desk's record panel.
 */
import {
	type AttributeRecord,
	type AttributeRecordStore,
	CORE_ATTRIBUTE_KINDS,
	createAttributeEngine,
	createAttributeKindRegistry,
	createKeyValueRecordStore,
} from '#lib/dynamic-attributes/index.ts';
import { ratingKind } from './rating-kind.ts';

export const SHOWCASE_RECORD_KEY = 'v10r:showcase:dynamic-attributes:record';
export const SHOWCASE_DRAFT_NAMESPACE = 'record-showcase';
/** Draft slots belong to a user; the showcase has none, so every visitor is this one. */
export const SHOWCASE_DRAFT_USER = 'showcase';

/** A nearly empty record: one attribute, a label waiting for a value. */
export const SEED_RECORD: AttributeRecord = {
	format: 1,
	attributes: [{ id: 'att_000000000a', label: 'Name', kind: 'text', value: '', config: {} }],
	removed: [],
};

export const showcaseKinds = createAttributeKindRegistry([...CORE_ATTRIBUTE_KINDS, ratingKind]);

export function createShowcaseEngine() {
	return createAttributeEngine(showcaseKinds);
}

/** The shared store, plus a switch that makes saves fail the way a dropped connection does. */
export function createShowcaseStore(storage: () => Storage, isOffline: () => boolean): AttributeRecordStore {
	const store = createKeyValueRecordStore(storage, SHOWCASE_RECORD_KEY, { kinds: showcaseKinds });
	return {
		load: () => store.load(),
		async save(record, expectedVersion) {
			// Slow enough to see "Saving…", like a real round trip.
			await new Promise((resolve) => setTimeout(resolve, 250));
			if (isOffline()) throw new Error('offline');
			return store.save(record, expectedVersion);
		},
	};
}

/** Example payloads for the import box: one that is valid and three the codec must refuse. */
export const SAMPLE_PAYLOADS = {
	valid: JSON.stringify(
		{
			format: 1,
			attributes: [
				{ id: 'att_00000000a1', label: 'Callsign', kind: 'text', value: 'Kestrel', config: {} },
				{ id: 'att_00000000a2', label: 'Crew', kind: 'number', value: 4, config: { min: 1, integer: true } },
				{ id: 'att_00000000a3', label: 'Hull plating', kind: 'app.armor', value: { layers: 3 }, config: {} },
			],
			removed: [],
		},
		null,
		2,
	),
	pollution: '{"format":1,"removed":[],"attributes":[],"__proto__":{"isAdmin":true}}',
	wrongType: JSON.stringify({
		format: 1,
		removed: [],
		attributes: [{ id: 'att_00000000b1', label: 'Age', kind: 'number', value: 'thirty', config: {} }],
	}),
	script: JSON.stringify({
		format: 1,
		removed: [],
		attributes: [
			{ id: 'att_00000000c1', label: 'x', kind: 'text', value: '', config: {}, onRender: 'fetch("//evil")' },
		],
	}),
} as const;
