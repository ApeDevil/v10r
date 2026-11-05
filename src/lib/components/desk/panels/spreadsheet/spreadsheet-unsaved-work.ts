import { createDocumentSessions } from '#lib/state/document-sessions.ts';
import type { UnsavedWork } from '#lib/state/unsaved-work.ts';
import { SPREADSHEET_DRAFT_NAMESPACE } from './spreadsheet-drafts';

/**
 * The open spreadsheet sessions of this tab, and sign-out's view of the spreadsheet work that
 * exists only on this device. Separate from `spreadsheet-session.svelte.ts` so the shell's
 * lazy sign-out import does not pull the sheet state and formula engine along.
 */
const sessions = createDocumentSessions<{
	sheet: { commitEdit(): void };
	autosave: { flush(): Promise<void>; readonly snapshot: { unsaved: boolean } };
}>(SPREADSHEET_DRAFT_NAMESPACE, (session) => {
	// The cell being typed into is work too; commit it so the flush sends it.
	session.sheet.commitEdit();
});

export const openSpreadsheetSession = sessions.open;

export function spreadsheetUnsavedWork(userId: string, storage: () => Storage = () => localStorage): UnsavedWork {
	return sessions.unsavedWork(userId, storage);
}
