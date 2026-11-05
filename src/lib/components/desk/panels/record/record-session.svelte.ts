import {
	acceptsAttributeRecord,
	createRecordSession,
	RECORD_DRAFT_NAMESPACE,
} from '#lib/components/composites/attributes/index.ts';
import { coreAttributeKinds, createAttributeEngine } from '#lib/dynamic-attributes/index.ts';
import { createDocumentDrafts } from '#lib/state/document-drafts.ts';
import { createDeskRecordStore } from './record-store';
import { openRecordSession, RECORD_SESSION_NAMESPACE } from './record-unsaved-work';

if (RECORD_SESSION_NAMESPACE !== RECORD_DRAFT_NAMESPACE) throw new Error('Record draft namespaces disagree');

/**
 * The desk's session for one record file: the core kinds, the HTTP store, a draft slot per
 * page load. Created only on mount, never on the server; reopening a panel reuses it.
 */
export function getDeskRecordSession(userId: string, fileId: string) {
	return openRecordSession(userId, fileId, () => {
		const engine = createAttributeEngine(coreAttributeKinds);
		return createRecordSession({
			engine,
			store: createDeskRecordStore(fileId, { kinds: engine.kinds, limits: engine.limits }),
			drafts: createDocumentDrafts(() => localStorage, {
				namespace: RECORD_DRAFT_NAMESPACE,
				userId,
				fileId,
				writerId: crypto.randomUUID(),
				accepts: acceptsAttributeRecord(engine),
			}),
		});
	});
}
