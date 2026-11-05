/**
 * The autosave: a framework-free save queue for one document a person edits and a server
 * stores under an optimistic-concurrency `version`. Its lifetime is the document, not any one
 * panel — a panel that closes or moves does not cancel the save it started.
 *
 * Contract, whatever the content (spreadsheet cells, an attribute record):
 * - every change is backed up synchronously to a device draft before any network;
 * - saves are debounced, one in flight at a time, each naming the version it was based on;
 * - a stale save (`conflict`) pauses saving — local work is never sent over newer remote work,
 *   and remote work never replaces unsaved local work;
 * - a conflict resolves only by an explicit choice: discard and reload, or `rebase` through a
 *   caller-supplied merge of base, local and remote;
 * - a failed load never enables editing; a failed save keeps the draft and retries on demand.
 */
import type { DocumentDraft, DocumentDrafts } from './document-drafts.ts';

export interface DocumentSnapshot<T> {
	content: T;
	version: number;
}

export type DocumentSave = { status: 'saved'; version: number } | { status: 'conflict' };

export interface DocumentAutosaveOptions<T> {
	load: () => Promise<DocumentSnapshot<T>>;
	save: (snapshot: DocumentSnapshot<T>) => Promise<DocumentSave>;
	drafts: DocumentDrafts<T>;
	apply: (content: T) => void;
	/** Debounce before a change is sent. */
	delayMs?: number;
}

/**
 * Three-way resolution for `rebase`: the content both sides started from, this editor's, and the
 * server's. Returns the content to save over the server's version, or null to stay in conflict.
 */
export type DocumentRebase<T> = (base: T, local: T, remote: T) => T | null;

export function createDocumentAutosave<T>(options: DocumentAutosaveOptions<T>) {
	let version = 0;
	let content: T | undefined;
	/** What the server holds at `version` — the base a rebase merges from. Unknown after adopting a stale draft. */
	let confirmed: T | undefined;
	let pending: T | null = null;
	let preview: T | null = null;
	let loaded = false;
	let conflict = false;
	let error = false;
	let backupFailed = false;
	let recovery: DocumentDraft<T>[] = [];
	let generation = 0;
	let readSequence = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let saving: Promise<void> | undefined;
	const listeners = new Set<() => void>();
	const emit = () => {
		for (const listener of listeners) listener();
	};
	const unsaved = () => pending !== null || preview !== null;

	function persist() {
		try {
			const draft = preview ?? pending;
			if (draft) options.drafts.write(version, draft);
			else options.drafts.clear();
			backupFailed = false;
		} catch {
			backupFailed = true;
		}
	}

	async function refresh() {
		// A read of our own in-flight write must not be mistaken for another writer.
		if (saving) await saving;
		const sequence = ++readSequence;
		const start = generation;
		try {
			const remote = await options.load();
			if (sequence !== readSequence || generation !== start) return;
			if (loaded && unsaved()) {
				if (remote.version !== version) conflict = true;
			} else {
				content = confirmed = remote.content;
				version = remote.version;
				loaded = true;
				options.apply(content);
			}
			error = false;
			try {
				recovery = options.drafts.list();
			} catch {
				backupFailed = true;
			}
		} catch {
			if (sequence === readSequence) error = true;
		}
		emit();
	}

	function schedule() {
		clearTimeout(timer);
		timer = setTimeout(() => {
			void flush();
		}, options.delayMs ?? 1500);
	}

	function change(next: T) {
		if (!loaded) return;
		content = next;
		pending = next;
		preview = null;
		generation++;
		persist();
		emit();
		if (!conflict) schedule();
	}

	function stage(next: T | null) {
		if (!loaded) return;
		preview = next;
		generation++;
		persist();
		emit();
	}

	function flush(): Promise<void> {
		clearTimeout(timer);
		if (saving) return saving;
		if (!loaded || !pending || conflict) return Promise.resolve();
		error = false;
		generation++;
		// Microtask start ensures `saving` exists even if the transport throws synchronously.
		saving = Promise.resolve()
			.then(async () => {
				while (pending && !conflict) {
					const sent = pending;
					try {
						const result = await options.save({ content: sent, version });
						generation++;
						if (result.status === 'conflict') {
							conflict = true;
							break;
						}
						version = result.version;
						confirmed = sent;
						if (pending === sent) pending = null;
						persist();
					} catch {
						error = true;
						break;
					}
				}
			})
			.finally(() => {
				saving = undefined;
				emit();
			});
		emit();
		return saving;
	}

	/** Retire a sibling slot: its work is now this session's, or the user waved it off. */
	function forget(draft: DocumentDraft<T>) {
		try {
			options.drafts.discard(draft.key);
		} catch {
			backupFailed = true;
		}
		recovery = recovery.filter((entry) => entry.key !== draft.key);
	}

	function recover(draft: DocumentDraft<T>) {
		if (!loaded || unsaved() || saving) return;
		conflict = draft.version !== version;
		// Never silently rebase a stale draft onto the latest server version.
		version = draft.version;
		if (conflict) confirmed = undefined;
		// Retire the source slot before adopting: once the save settles the banner
		// returns, and it must not re-offer the draft it just handed over.
		forget(draft);
		options.apply(draft.content);
		change(draft.content);
	}

	async function discardAndReload() {
		clearTimeout(timer);
		if (saving) await saving;
		// Fetch first: an offline reload must not destroy the only copy of local work.
		const start = generation;
		try {
			const remote = await options.load();
			if (generation !== start) return;
			++readSequence;
			clearTimeout(timer);
			content = confirmed = remote.content;
			version = remote.version;
			pending = preview = null;
			conflict = error = false;
			loaded = true;
			options.apply(content);
			persist();
		} catch {
			error = true;
		}
		emit();
	}

	/**
	 * Leave a conflict by merging: load the server's content, hand base/local/remote to `resolve`,
	 * and save what it returns on top of the server's version. Refuses — staying in conflict,
	 * changing nothing — when the base is unknown, input is still being typed, the load fails,
	 * the user edits meanwhile, or `resolve` returns null.
	 */
	async function rebase(resolve: DocumentRebase<T>): Promise<'merged' | 'unresolved' | 'failed'> {
		clearTimeout(timer);
		if (saving) await saving;
		if (!conflict || confirmed === undefined || preview !== null || content === undefined) return 'unresolved';
		const start = generation;
		let remote: DocumentSnapshot<T>;
		try {
			remote = await options.load();
		} catch {
			error = true;
			emit();
			return 'failed';
		}
		if (generation !== start) return 'unresolved';
		const merged = resolve(confirmed, pending ?? content, remote.content);
		if (merged === null) return 'unresolved';
		++readSequence;
		version = remote.version;
		confirmed = remote.content;
		conflict = error = false;
		content = pending = merged;
		generation++;
		options.apply(merged);
		persist();
		emit();
		await flush();
		return conflict ? 'unresolved' : 'merged';
	}

	return {
		refresh,
		rebase,
		change,
		stage,
		flush,
		recover,
		dismiss(draft: DocumentDraft<T>) {
			forget(draft);
			emit();
		},
		discardAndReload,
		subscribe(listener: () => void) {
			listeners.add(listener);
			listener();
			return () => {
				listeners.delete(listener);
			};
		},
		get snapshot() {
			return {
				loaded,
				conflict,
				error,
				backupFailed,
				recovery,
				saving: !!saving,
				unsaved: unsaved(),
				canRebase: conflict && confirmed !== undefined,
			};
		},
		get draft() {
			return { version, content: preview ?? pending ?? content };
		},
	};
}

export type DocumentAutosave<T> = ReturnType<typeof createDocumentAutosave<T>>;
