import type { UnsavedWork } from '$lib/state/unsaved-work';
import { removeUserSpreadsheetDrafts, userSpreadsheetDraftFiles } from './spreadsheet-drafts';

/**
 * The open spreadsheet sessions of this tab, and sign-out's view of the spreadsheet work
 * that exists only on this device.
 *
 * Kept apart from `spreadsheet-session.svelte.ts` on purpose: sign-out lazy-loads this
 * module from the shell, on any page, and must not pull the sheet state and formula
 * engine along. The session module creates sessions through `openSpreadsheetSession`, so
 * there is one map, and it lives here.
 */
interface OpenSpreadsheet {
	sheet: { commitEdit(): void };
	autosave: { flush(): Promise<void>; readonly snapshot: { unsaved: boolean } };
}

const sessions = new Map<string, { userId: string; fileId: string; session: OpenSpreadsheet }>();

/** The registered session for this user's file, or the one `create` makes — once per tab. */
export function openSpreadsheetSession<T extends OpenSpreadsheet>(userId: string, fileId: string, create: () => T): T {
	const key = JSON.stringify([userId, fileId]);
	let entry = sessions.get(key);
	if (!entry) {
		entry = { userId, fileId, session: create() };
		sessions.set(key, entry);
	}
	return entry.session as T;
}

/**
 * `count` is the union of this tab's unsaved sessions and every draft slot in storage:
 * a slot outlives its tab (another tab, an earlier page load whose save failed), and the
 * server's `Clear-Site-Data: "storage"` erases them all alike. An open session is counted
 * from memory too, because its slot is missing exactly when the backup write failed.
 */
export function spreadsheetUnsavedWork(userId: string, storage: () => Storage = () => localStorage): UnsavedWork {
	const open = () => [...sessions.values()].filter((entry) => entry.userId === userId);
	return {
		async drain() {
			await Promise.allSettled(
				open().map(({ session }) => {
					// The cell being typed into is work too; commit it so the flush sends it.
					session.sheet.commitEdit();
					return session.autosave.flush();
				}),
			);
		},
		count() {
			let files: Set<string>;
			try {
				files = userSpreadsheetDraftFiles(storage(), userId);
			} catch {
				files = new Set(); // Storage unavailable: memory is the only copy, counted below.
			}
			for (const { fileId, session } of open()) if (session.autosave.snapshot.unsaved) files.add(fileId);
			return files.size;
		},
		discard() {
			// A later sign-in in this tab loads from the server, not from the discarded edits.
			for (const [key, entry] of sessions) if (entry.userId === userId) sessions.delete(key);
			removeUserSpreadsheetDrafts(storage(), userId);
		},
	};
}
