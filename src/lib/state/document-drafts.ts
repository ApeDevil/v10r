/**
 * Device drafts for an autosaved document: the copy of unsaved work that survives a reload, a
 * crash or a failed save. One slot per document session (`writerId`), so one tab never erases
 * another tab's backup; a slot outlives its tab and is offered for recovery until it is adopted
 * or dismissed.
 *
 * Slot key: `v10r:<namespace>-draft:<user>:<file>:<writer>`, each segment URI-encoded so it holds
 * no `:`. The namespace is the document kind (`spreadsheet`, `record`). A stored draft is read
 * back through `accepts` — storage is another writer, and a malformed slot must neither crash
 * the editor nor hide the slots that are fine.
 */

export interface DocumentDraft<T> {
	key: string;
	version: number;
	content: T;
	updatedAt: number;
}

export interface DocumentDraftSlot<T> {
	/** Document kind, part of every key. Lowercase, no `:`. */
	namespace: string;
	userId: string;
	fileId: string;
	/** This document session; a fresh one per page load. */
	writerId: string;
	/** Whether stored JSON is content of this document kind. */
	accepts: (content: unknown) => content is T;
}

const userDraftPrefix = (namespace: string, userId: string) => `v10r:${namespace}-draft:${encodeURIComponent(userId)}:`;

/** The files this user has a draft slot for on this device — any tab, any page load. */
export function userDocumentDraftFiles(storage: Storage, namespace: string, userId: string): Set<string> {
	const prefix = userDraftPrefix(namespace, userId);
	const files = new Set<string>();
	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (key?.startsWith(prefix)) files.add(decodeURIComponent(key.slice(prefix.length).split(':')[0]));
	}
	return files;
}

/** Erase every draft slot of this kind the user has on this device (sign-out on a possibly shared device). */
export function removeUserDocumentDrafts(storage: Storage, namespace: string, userId: string): void {
	const prefix = userDraftPrefix(namespace, userId);
	const keys: string[] = [];
	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (key?.startsWith(prefix)) keys.push(key);
	}
	// Collected first: removing while iterating shifts the indices under the loop.
	for (const key of keys) storage.removeItem(key);
}

export function createDocumentDrafts<T>(storage: () => Storage, slot: DocumentDraftSlot<T>) {
	const prefix = `${userDraftPrefix(slot.namespace, slot.userId)}${encodeURIComponent(slot.fileId)}:`;
	const key = `${prefix}${slot.writerId}`;
	return {
		write(version: number, content: T) {
			storage().setItem(key, JSON.stringify({ version, content, updatedAt: Date.now() }));
		},
		clear() {
			storage().removeItem(key);
		},
		/** Drop a sibling slot once its work has been adopted or waved off. */
		discard(other: string) {
			if (other === key || !other.startsWith(prefix)) return;
			storage().removeItem(other);
		},
		list(): DocumentDraft<T>[] {
			const store = storage();
			const drafts: DocumentDraft<T>[] = [];
			for (let i = 0; i < store.length; i++) {
				const candidate = store.key(i);
				if (!candidate?.startsWith(prefix) || candidate === key) continue;
				try {
					const draft = JSON.parse(store.getItem(candidate) ?? 'null');
					if (
						!draft ||
						!Number.isInteger(draft.version) ||
						draft.version < 0 ||
						!Number.isFinite(draft.updatedAt) ||
						!slot.accepts(draft.content)
					)
						continue;
					drafts.push({ version: draft.version, content: draft.content, updatedAt: draft.updatedAt, key: candidate });
				} catch {
					// A malformed slot must not hide other recoverable drafts.
				}
			}
			return drafts.sort((a, b) => b.updatedAt - a.updatedAt);
		},
	};
}

export type DocumentDrafts<T> = Pick<
	ReturnType<typeof createDocumentDrafts<T>>,
	'write' | 'clear' | 'discard' | 'list'
>;
