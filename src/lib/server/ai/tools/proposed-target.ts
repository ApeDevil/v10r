/**
 * Reads the reviewed baseline a gated tool puts on its `requiresApproval` sentinel.
 *
 * Captured when the plan is PROPOSED — the version the PlanCard describes — and carried
 * on the persisted step so `executeDeskToolCall` can compare against it at approval.
 * One reader for the write tools, the delete tool and `validateProposedPlan`, so a new
 * file type learns its version column in exactly one place.
 */
import { getFile, getMarkdownByFileId, getSpreadsheetByFileId } from '$lib/server/db/desk/queries';
import type { ProposedTarget } from '$lib/server/db/schema/ai/proposal';

export async function readProposedTarget(userId: string, fileId: string): Promise<ProposedTarget | null> {
	const fileRow = await getFile(fileId, userId);
	if (!fileRow) return null;
	const version =
		fileRow.type === 'spreadsheet'
			? ((await getSpreadsheetByFileId(fileId, userId))?.spreadsheet.version ?? null)
			: ((await getMarkdownByFileId(fileId, userId))?.markdown.version ?? null);
	return {
		fileId: fileRow.id,
		fileType: fileRow.type,
		name: fileRow.name,
		version,
		updatedAt: fileRow.updatedAt.toISOString(),
	};
}
