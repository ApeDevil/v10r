/**
 * The open document sessions of one document kind in this tab, and sign-out's view of the work
 * of that kind that exists only on this device (`UnsavedWork`).
 *
 * A session — content state plus its autosave — outlives the panel that opened it, so a layout
 * move or a closed tab strip keeps the pending save. There is one session per user and file
 * per tab; `open` returns the registered one or registers what `create` makes.
 *
 * Kept free of any document's state and engine on purpose: sign-out lazy-loads the kind's
 * unsaved-work module from the shell, on any page, and must not pull the editor along.
 */
import { removeUserDocumentDrafts, userDocumentDraftFiles } from './document-drafts.ts';
import type { UnsavedWork } from './unsaved-work.ts';

export interface OpenDocumentSession {
	autosave: { flush(): Promise<void>; readonly snapshot: { unsaved: boolean } };
}

export function createDocumentSessions<S extends OpenDocumentSession>(
	namespace: string,
	/** Turn input still being typed into a committed change, so a drain sends it. */
	commit: (session: S) => void = () => {},
) {
	const sessions = new Map<string, { userId: string; fileId: string; session: S }>();

	return {
		open<T extends S>(userId: string, fileId: string, create: () => T): T {
			const key = JSON.stringify([userId, fileId]);
			let entry = sessions.get(key);
			if (!entry) {
				entry = { userId, fileId, session: create() };
				sessions.set(key, entry);
			}
			return entry.session as T;
		},
		/**
		 * `count` is the union of this tab's unsaved sessions and every draft slot in storage: a slot
		 * outlives its tab, and the server's `Clear-Site-Data: "storage"` erases them all alike. An
		 * open session is counted from memory too, because its slot is missing exactly when the
		 * backup write failed.
		 */
		unsavedWork(userId: string, storage: () => Storage = () => localStorage): UnsavedWork {
			const open = () => [...sessions.values()].filter((entry) => entry.userId === userId);
			return {
				async drain() {
					await Promise.allSettled(
						open().map(({ session }) => {
							commit(session);
							return session.autosave.flush();
						}),
					);
				},
				count() {
					let files: Set<string>;
					try {
						files = userDocumentDraftFiles(storage(), namespace, userId);
					} catch {
						files = new Set(); // Storage unavailable: memory is the only copy, counted below.
					}
					for (const { fileId, session } of open()) if (session.autosave.snapshot.unsaved) files.add(fileId);
					return files.size;
				},
				discard() {
					// A later sign-in in this tab loads from the server, not from the discarded edits.
					for (const [key, entry] of sessions) if (entry.userId === userId) sessions.delete(key);
					removeUserDocumentDrafts(storage(), namespace, userId);
				},
			};
		},
	};
}
