/**
 * Architecture drafts: saved architecture files kept in this browser only.
 *
 * Local-first on purpose (plan §4.7): no database schema and no sign-in for a drafting tool,
 * and the UI says plainly that drafts live in this browser. Storage is injected
 * (`() => Storage | null`, the `form-draft.ts` convention), so private mode, a full quota or
 * SSR degrade to "nothing saved" instead of an exception.
 *
 * Every read goes through `parseArchitectureFile`: a stored draft is untrusted input like any
 * import (another tab, an older version, a hand edit). A corrupt or unsupported entry is
 * reported as such, never thrown, and never silently replaced.
 *
 * The contract is the file text, not this store: a server-side store can replace it later
 * without touching the architecture model.
 */
import {
	type ArchitectureFile,
	type ModelIssue,
	parseArchitectureFile,
	stringifyArchitectureFile,
} from '#patterns/architecture-engineering/index.ts';

const PREFIX = 'v10r:studio:architecture';
const INDEX_KEY = `${PREFIX}:index`;
const WORKING_KEY = `${PREFIX}:working`;
const draftKey = (id: string) => `${PREFIX}:draft:${id}`;

export interface ArchitectureDraftEntry {
	id: string;
	name: string;
	savedAt: string;
	derived_from?: string;
}

export type DraftRead =
	| { ok: true; file: ArchitectureFile }
	| { ok: false; reason: 'missing' | 'corrupt'; issues: ModelIssue[] };

export type DraftWrite = { ok: true } | { ok: false; reason: 'unavailable' | 'quota' };

function readIndex(storage: Storage): ArchitectureDraftEntry[] {
	let raw: string | null;
	try {
		raw = storage.getItem(INDEX_KEY);
	} catch {
		return [];
	}
	if (!raw) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(entry): entry is ArchitectureDraftEntry =>
				typeof entry === 'object' &&
				entry !== null &&
				typeof entry.id === 'string' &&
				typeof entry.name === 'string' &&
				typeof entry.savedAt === 'string',
		);
	} catch {
		return [];
	}
}

function write(storage: Storage, key: string, value: string): DraftWrite {
	try {
		storage.setItem(key, value);
		return { ok: true };
	} catch {
		return { ok: false, reason: 'quota' };
	}
}

function read(storage: Storage | null, key: string): DraftRead {
	if (!storage) return { ok: false, reason: 'missing', issues: [] };
	let text: string | null;
	try {
		text = storage.getItem(key);
	} catch {
		return { ok: false, reason: 'missing', issues: [] };
	}
	if (text === null) return { ok: false, reason: 'missing', issues: [] };
	const parsed = parseArchitectureFile(text);
	return parsed.ok ? { ok: true, file: parsed.file } : { ok: false, reason: 'corrupt', issues: parsed.issues };
}

export function createArchitectureDraftStore(getStorage: () => Storage | null, now: () => Date = () => new Date()) {
	return {
		/** Saved drafts, most recent first. */
		list(): ArchitectureDraftEntry[] {
			const storage = getStorage();
			return storage
				? readIndex(storage).sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0))
				: [];
		},
		save(file: ArchitectureFile): DraftWrite {
			const storage = getStorage();
			if (!storage) return { ok: false, reason: 'unavailable' };
			const written = write(storage, draftKey(file.model.id), stringifyArchitectureFile(file));
			if (!written.ok) return written;
			const entry: ArchitectureDraftEntry = {
				id: file.model.id,
				name: file.model.name,
				savedAt: now().toISOString(),
				...(file.model.derived_from ? { derived_from: file.model.derived_from } : {}),
			};
			const index = readIndex(storage).filter((existing) => existing.id !== entry.id);
			return write(storage, INDEX_KEY, JSON.stringify([...index, entry]));
		},
		load(id: string): DraftRead {
			return read(getStorage(), draftKey(id));
		},
		remove(id: string): void {
			const storage = getStorage();
			if (!storage) return;
			try {
				storage.removeItem(draftKey(id));
			} catch {
				// Removing from unavailable storage has nothing to undo.
			}
			write(storage, INDEX_KEY, JSON.stringify(readIndex(storage).filter((entry) => entry.id !== id)));
		},
		/** The unsaved working copy, kept on every edit so a reload or a crash loses nothing. */
		saveWorking(file: ArchitectureFile): DraftWrite {
			const storage = getStorage();
			if (!storage) return { ok: false, reason: 'unavailable' };
			return write(storage, WORKING_KEY, stringifyArchitectureFile(file));
		},
		loadWorking(): DraftRead {
			return read(getStorage(), WORKING_KEY);
		},
	};
}

export type ArchitectureDraftStore = ReturnType<typeof createArchitectureDraftStore>;

/** `localStorage` when the browser offers it; `null` on the server or when access throws. */
export function browserStorage(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}
