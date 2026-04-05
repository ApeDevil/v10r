import * as v from 'valibot';
import { requireApiUser } from '$lib/server/auth/guards';
import {
	deleteFile,
	duplicateSpreadsheetFile,
	moveFile,
	renameFile,
	toggleFileAiContext,
	updateSpreadsheetByFileId,
} from '$lib/server/db/desk/mutations';
import { getFile, getSpreadsheetByFileId } from '$lib/server/db/desk/queries';
import { apiOk, apiCreated, apiNoContent, apiError, apiValidationError } from '$lib/server/api/response';
import type { RequestHandler } from './$types';

const UpdateFileSchema = v.object({
	name: v.optional(v.pipe(v.string(), v.maxLength(200))),
	folderId: v.optional(v.nullable(v.string())),
	aiContext: v.optional(v.boolean()),
	cells: v.optional(v.record(v.string(), v.any())),
	columnMeta: v.optional(v.nullable(v.record(v.string(), v.any()))),
});

/** Get a file with its detail data. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);
	const fileRow = await getFile(params.id, user.id);
	if (!fileRow) return apiError(404, 'not_found', 'Not found.');

	if (fileRow.type === 'spreadsheet') {
		const result = await getSpreadsheetByFileId(params.id, user.id);
		if (!result) return apiError(404, 'not_found', 'Not found.');
		return apiOk({ file: result.file, spreadsheet: result.spreadsheet });
	}

	return apiOk({ file: fileRow });
};

/** Update a file (rename, move, toggle AI context) and/or its detail data. */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const { user } = requireApiUser(locals);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(UpdateFileSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	const { name, folderId, aiContext, cells, columnMeta } = parsed.output;

	// Handle move
	if (folderId !== undefined) {
		const row = await moveFile(params.id, user.id, folderId);
		if (!row) return apiError(404, 'not_found', 'Not found.');
	}

	// Handle AI context toggle
	if (aiContext !== undefined) {
		const row = await toggleFileAiContext(params.id, user.id, aiContext);
		if (!row) return apiError(404, 'not_found', 'Not found.');
	}

	// Handle rename (no cell data)
	const hasCellUpdate = cells !== undefined || columnMeta !== undefined;
	if (name !== undefined && !hasCellUpdate) {
		const row = await renameFile(params.id, user.id, name);
		if (!row) return apiError(404, 'not_found', 'Not found.');
		return apiOk({ file: row });
	}

	// Spreadsheet-specific update (cells and/or columnMeta, optionally name)
	if (hasCellUpdate) {
		const row = await updateSpreadsheetByFileId(params.id, user.id, parsed.output);
		if (!row) return apiError(404, 'not_found', 'Not found.');
		return apiOk({ file: row });
	}

	// If only moved or toggled AI context, re-fetch
	if (folderId !== undefined || aiContext !== undefined) {
		const row = await getFile(params.id, user.id);
		return apiOk({ file: row });
	}

	return apiError(400, 'no_fields', 'No update fields provided.');
};

/** Duplicate a file. */
export const POST: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);
	const result = await duplicateSpreadsheetFile(params.id, user.id);
	if (!result) return apiError(404, 'not_found', 'Not found.');
	return apiCreated({ file: result.file, spreadsheet: result.spreadsheet });
};

/** Delete a file (cascades to detail table). */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);
	const row = await deleteFile(params.id, user.id);
	if (!row) return apiError(404, 'not_found', 'Not found.');
	return apiNoContent();
};
