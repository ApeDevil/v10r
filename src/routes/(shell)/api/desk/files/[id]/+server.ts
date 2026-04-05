import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import { safeParse } from 'valibot';
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
	if (!fileRow) return json({ error: 'Not found.' }, { status: 404 });

	if (fileRow.type === 'spreadsheet') {
		const result = await getSpreadsheetByFileId(params.id, user.id);
		if (!result) return json({ error: 'Not found.' }, { status: 404 });
		return json({ file: result.file, spreadsheet: result.spreadsheet });
	}

	return json({ file: fileRow });
};

/** Update a file (rename, move, toggle AI context) and/or its detail data. */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const { user } = requireApiUser(locals);

	const body = await request.json().catch(() => null);
	if (!body) return json({ error: 'Invalid request body.' }, { status: 400 });

	const parsed = safeParse(UpdateFileSchema, body);
	if (!parsed.success) {
		return json({ error: 'Invalid request.' }, { status: 400 });
	}

	const { name, folderId, aiContext, cells, columnMeta } = parsed.output;

	// Handle move
	if (folderId !== undefined) {
		const row = await moveFile(params.id, user.id, folderId);
		if (!row) return json({ error: 'Not found.' }, { status: 404 });
	}

	// Handle AI context toggle
	if (aiContext !== undefined) {
		const row = await toggleFileAiContext(params.id, user.id, aiContext);
		if (!row) return json({ error: 'Not found.' }, { status: 404 });
	}

	// Handle rename (no cell data)
	const hasCellUpdate = cells !== undefined || columnMeta !== undefined;
	if (name !== undefined && !hasCellUpdate) {
		const row = await renameFile(params.id, user.id, name);
		if (!row) return json({ error: 'Not found.' }, { status: 404 });
		return json({ file: row });
	}

	// Spreadsheet-specific update (cells and/or columnMeta, optionally name)
	if (hasCellUpdate) {
		const row = await updateSpreadsheetByFileId(params.id, user.id, parsed.output);
		if (!row) return json({ error: 'Not found.' }, { status: 404 });
		return json({ file: row });
	}

	// If only moved or toggled AI context, re-fetch
	if (folderId !== undefined || aiContext !== undefined) {
		const row = await getFile(params.id, user.id);
		return json({ file: row });
	}

	return json({ error: 'No update fields provided.' }, { status: 400 });
};

/** Duplicate a file. */
export const POST: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);
	const result = await duplicateSpreadsheetFile(params.id, user.id);
	if (!result) return json({ error: 'Not found.' }, { status: 404 });
	return json({ file: result.file, spreadsheet: result.spreadsheet }, { status: 201 });
};

/** Delete a file (cascades to detail table). */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);
	const row = await deleteFile(params.id, user.id);
	if (!row) return json({ error: 'Not found.' }, { status: 404 });
	return json({ success: true });
};
