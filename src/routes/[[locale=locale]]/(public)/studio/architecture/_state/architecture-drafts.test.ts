import { describe, expect, it } from 'vitest';
import { createArchitectureModel, stringifyArchitectureFile } from '#patterns/architecture-engineering/index.ts';
import { createArchitectureDraftStore } from './architecture-drafts.ts';

/** A Storage double; `full` makes every write throw like a quota error. */
function memoryStorage(full = false): Storage & { map: Map<string, string> } {
	const map = new Map<string, string>();
	return {
		map,
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (k) => map.get(k) ?? null,
		key: (i) => [...map.keys()][i] ?? null,
		removeItem: (k) => void map.delete(k),
		setItem: (k, v) => {
			if (full) throw new DOMException('quota', 'QuotaExceededError');
			map.set(k, v);
		},
	};
}

function clock() {
	let t = Date.UTC(2026, 10, 8);
	return () => new Date((t += 1000));
}

describe('architecture drafts', () => {
	it('saves, lists most recent first, loads and removes drafts', () => {
		const storage = memoryStorage();
		const store = createArchitectureDraftStore(() => storage, clock());
		const a = createArchitectureModel('a', 'First');
		const b = createArchitectureModel('b', 'Second');
		expect(store.save({ model: a })).toEqual({ ok: true });
		expect(store.save({ model: b })).toEqual({ ok: true });
		expect(store.list().map((entry) => entry.id)).toEqual(['b', 'a']);

		const loaded = store.load('a');
		expect(loaded.ok && stringifyArchitectureFile(loaded.file)).toBe(stringifyArchitectureFile({ model: a }));

		store.remove('a');
		expect(store.list().map((entry) => entry.id)).toEqual(['b']);
		expect(store.load('a')).toMatchObject({ ok: false, reason: 'missing' });
	});

	it('re-saving a draft replaces its index entry instead of duplicating it', () => {
		const storage = memoryStorage();
		const store = createArchitectureDraftStore(() => storage, clock());
		const model = createArchitectureModel('a', 'First');
		store.save({ model });
		store.save({ model: { ...model, name: 'Renamed' } });
		expect(store.list()).toHaveLength(1);
		expect(store.list()[0]?.name).toBe('Renamed');
	});

	it('treats stored text as untrusted: a tampered draft is reported corrupt, never thrown', () => {
		const storage = memoryStorage();
		const store = createArchitectureDraftStore(() => storage, clock());
		store.save({ model: createArchitectureModel('a', 'First') });
		storage.map.set('v10r:studio:architecture:draft:a', '{"model":{"format":99}}');
		expect(store.load('a')).toMatchObject({ ok: false, reason: 'corrupt' });
		storage.map.set('v10r:studio:architecture:draft:a', 'not json');
		expect(store.load('a')).toMatchObject({ ok: false, reason: 'corrupt' });
		storage.map.set('v10r:studio:architecture:index', '{"not":"a list"}');
		expect(store.list()).toEqual([]);
	});

	it('degrades to "nothing saved" without storage or with a full quota', () => {
		const none = createArchitectureDraftStore(() => null);
		expect(none.save({ model: createArchitectureModel('a', 'First') })).toEqual({ ok: false, reason: 'unavailable' });
		expect(none.list()).toEqual([]);
		expect(none.loadWorking()).toMatchObject({ ok: false, reason: 'missing' });

		const full = createArchitectureDraftStore(() => memoryStorage(true));
		expect(full.save({ model: createArchitectureModel('a', 'First') })).toEqual({ ok: false, reason: 'quota' });
	});

	it('keeps the working copy apart from the named drafts', () => {
		const storage = memoryStorage();
		const store = createArchitectureDraftStore(() => storage, clock());
		const model = createArchitectureModel('w', 'Working');
		store.saveWorking({ model });
		expect(store.list()).toEqual([]);
		const working = store.loadWorking();
		expect(working.ok && stringifyArchitectureFile(working.file)).toBe(stringifyArchitectureFile({ model }));
	});
});
