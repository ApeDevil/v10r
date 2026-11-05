/**
 * The persistence contract: where a record lives is the application's choice, and the editor
 * only ever sees this interface. Every implementation keeps one promise — **a save names the
 * version it was based on, and a stale save changes nothing** (optimistic concurrency). That
 * is what turns two editors, two tabs or an assistant writing at once into a visible conflict
 * instead of a lost update.
 *
 * Implementations here are the ones that need no server: a key-value store over any
 * `Storage`-shaped object (localStorage, or `memoryStorage()` in tests). The desk's server
 * store is an HTTP adapter over `PUT /api/desk/files/[id]`, which the database enforces with
 * a row lock and a version check (`db/desk/mutations.ts`).
 */
import { type AttributeCodecOptions, parseAttributeRecord, serializeAttributeRecord } from './codec.ts';
import { type AttributeRecord, emptyAttributeRecord } from './record.ts';

export interface AttributeRecordSnapshot {
	record: AttributeRecord;
	/** The optimistic-concurrency counter: bumped by every accepted save. */
	version: number;
}

export type AttributeRecordSave = { status: 'saved'; version: number } | { status: 'conflict' };

export interface AttributeRecordStore {
	load(): Promise<AttributeRecordSnapshot>;
	save(record: AttributeRecord, expectedVersion: number): Promise<AttributeRecordSave>;
}

/** A stored record this build will not open. The store is left exactly as it was. */
export class AttributeRecordLoadError extends Error {
	override readonly name = 'AttributeRecordLoadError';
}

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** A `Storage` that lives in memory — for tests, SSR and private-mode fallbacks. */
export function memoryStorage(): KeyValueStorage & { readonly size: number } {
	const map = new Map<string, string>();
	return {
		getItem: (key) => map.get(key) ?? null,
		setItem: (key, value) => {
			map.set(key, String(value));
		},
		removeItem: (key) => {
			map.delete(key);
		},
		get size() {
			return map.size;
		},
	};
}

/**
 * A store holding `{ version, record }` under one key. The read-check-write runs synchronously,
 * so within one JavaScript realm no other writer can interleave; across browser tabs sharing
 * localStorage it is best-effort, which is why a server store does the same check under a lock.
 * A missing key is an empty record at version 0. A stored value that does not parse is refused,
 * never replaced — the bytes stay for whoever can read them.
 */
export function createKeyValueRecordStore(
	storage: () => KeyValueStorage,
	key: string,
	codec: AttributeCodecOptions,
): AttributeRecordStore {
	function read(): AttributeRecordSnapshot {
		const text = storage().getItem(key);
		if (text === null) return { record: emptyAttributeRecord(), version: 0 };
		let stored: unknown;
		try {
			stored = JSON.parse(text);
		} catch {
			throw new AttributeRecordLoadError('The stored record is not JSON.');
		}
		const { version, record } = (stored ?? {}) as { version?: unknown; record?: unknown };
		if (!Number.isInteger(version) || (version as number) < 0) {
			throw new AttributeRecordLoadError('The stored record has no valid version.');
		}
		const parsed = parseAttributeRecord(record, codec);
		if (!parsed.ok) throw new AttributeRecordLoadError(parsed.problems.map((p) => p.message).join(' '));
		return { record: parsed.record, version: version as number };
	}

	return {
		async load() {
			return read();
		},
		async save(record, expectedVersion) {
			const parsed = parseAttributeRecord(record, codec);
			if (!parsed.ok) throw new AttributeRecordLoadError(parsed.problems.map((p) => p.message).join(' '));
			const current = read();
			if (current.version !== expectedVersion) return { status: 'conflict' };
			const version = current.version + 1;
			storage().setItem(key, `{"record":${serializeAttributeRecord(parsed.record)},"version":${version}}`);
			return { status: 'saved', version };
		},
	};
}
