import { createDocumentSessions } from '#lib/state/document-sessions.ts';
import type { UnsavedWork } from '#lib/state/unsaved-work.ts';

/**
 * The open record sessions of this tab, and sign-out's view of record work that exists only on
 * this device. Free of the editor and the record engine, so the shell's lazy sign-out import
 * stays small. The namespace is `RECORD_DRAFT_NAMESPACE` (`#lib/components/attributes`),
 * repeated as a literal here for that reason; `record-session.svelte.ts` asserts they agree.
 */
export const RECORD_SESSION_NAMESPACE = 'record';

const sessions = createDocumentSessions(RECORD_SESSION_NAMESPACE);

export const openRecordSession = sessions.open;

export function recordUnsavedWork(userId: string, storage: () => Storage = () => localStorage): UnsavedWork {
	return sessions.unsavedWork(userId, storage);
}
