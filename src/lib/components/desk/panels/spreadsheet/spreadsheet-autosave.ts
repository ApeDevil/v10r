import type { SpreadsheetCells } from '$lib/desk/spreadsheet-cells';
import type { SpreadsheetDraft, SpreadsheetDrafts } from './spreadsheet-drafts';

interface SpreadsheetSnapshot {
	cells: SpreadsheetCells;
	version: number;
}

interface AutosaveOptions {
	load: () => Promise<SpreadsheetSnapshot>;
	save: (snapshot: SpreadsheetSnapshot) => Promise<{ status: 'saved'; version: number } | { status: 'conflict' }>;
	drafts: SpreadsheetDrafts;
	apply: (cells: SpreadsheetCells) => void;
}

/** Framework-free save queue. Its lifetime is the document, not any one panel. */
export function createSpreadsheetAutosave(options: AutosaveOptions) {
	let version = 0;
	let cells: SpreadsheetCells = {};
	let pending: SpreadsheetCells | null = null;
	let preview: SpreadsheetCells | null = null;
	let loaded = false;
	let conflict = false;
	let error = false;
	let backupFailed = false;
	let recovery: SpreadsheetDraft[] = [];
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
				cells = remote.cells;
				version = remote.version;
				loaded = true;
				options.apply(cells);
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
		}, 1500);
	}

	function change(next: SpreadsheetCells) {
		if (!loaded) return;
		cells = next;
		pending = next;
		preview = null;
		generation++;
		persist();
		emit();
		if (!conflict) schedule();
	}

	function stage(next: SpreadsheetCells | null) {
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
						const result = await options.save({ cells: sent, version });
						generation++;
						if (result.status === 'conflict') {
							conflict = true;
							break;
						}
						version = result.version;
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
	function forget(draft: SpreadsheetDraft) {
		try {
			options.drafts.discard(draft.key);
		} catch {
			backupFailed = true;
		}
		recovery = recovery.filter((entry) => entry.key !== draft.key);
	}

	function recover(draft: SpreadsheetDraft) {
		if (!loaded || unsaved() || saving) return;
		conflict = draft.version !== version;
		// Never silently rebase a stale draft onto the latest server version.
		version = draft.version;
		// Retire the source slot before adopting: once the save settles the banner
		// returns, and it must not re-offer the draft it just handed over.
		forget(draft);
		options.apply(draft.cells);
		change(draft.cells);
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
			cells = remote.cells;
			version = remote.version;
			pending = preview = null;
			conflict = error = false;
			loaded = true;
			options.apply(cells);
			persist();
		} catch {
			error = true;
		}
		emit();
	}

	return {
		refresh,
		change,
		stage,
		flush,
		recover,
		dismiss(draft: SpreadsheetDraft) {
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
			return { loaded, conflict, error, backupFailed, recovery, saving: !!saving, unsaved: unsaved() };
		},
		get draft() {
			return { version, cells: preview ?? pending ?? cells };
		},
	};
}
