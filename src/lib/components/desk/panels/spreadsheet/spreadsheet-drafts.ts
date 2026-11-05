import type { PersistedCell, SpreadsheetCells } from '#lib/desk/spreadsheet-cells.ts';
import { createDocumentDrafts } from '#lib/state/document-drafts.ts';

/** The draft namespace of spreadsheet files: `v10r:spreadsheet-draft:…`. */
export const SPREADSHEET_DRAFT_NAMESPACE = 'spreadsheet';

/** Whether stored JSON is a sparse cell map the grid can load. */
export function isSpreadsheetCells(content: unknown): content is SpreadsheetCells {
	return (
		!!content &&
		typeof content === 'object' &&
		!Array.isArray(content) &&
		Object.values(content).every((cell) => {
			if (!cell || typeof cell !== 'object') return false;
			const { v, f, t } = cell as PersistedCell;
			return (
				(v === null || typeof v === 'string' || typeof v === 'number') &&
				(f === undefined || typeof f === 'string') &&
				(t === undefined || typeof t === 'string')
			);
		})
	);
}

/** Each document session owns a slot; one tab must never erase another tab's draft. */
export function createSpreadsheetDrafts(storage: () => Storage, userId: string, fileId: string, writerId: string) {
	return createDocumentDrafts(storage, {
		namespace: SPREADSHEET_DRAFT_NAMESPACE,
		userId,
		fileId,
		writerId,
		accepts: isSpreadsheetCells,
	});
}
