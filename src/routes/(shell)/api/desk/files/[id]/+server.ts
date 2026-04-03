import { json } from '@sveltejs/kit';
import { safeParse } from 'valibot';
import * as v from 'valibot';
import { requireApiUser } from '$lib/server/auth/guards';
import { deleteFile, renameFile, updateSpreadsheetByFileId } from '$lib/server/db/desk/mutations';
import { getFile, getSpreadsheetByFileId } from '$lib/server/db/desk/queries';
import type { RequestHandler } from './$types';

const UpdateFileSchema = v.object({
	name: v.optional(v.pipe(v.string(), v.maxLength(200))),
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

/** Update a file (rename) and/or its detail data (cells, columnMeta). */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const { user } = requireApiUser(locals);

	const body = await request.json().catch(() => null);
	if (!body) return json({ error: 'Invalid request body.' }, { status: 400 });

	const parsed = safeParse(UpdateFileSchema, body);
	if (!parsed.success) {
		return json({ error: 'Invalid request.' }, { status: 400 });
	}

	const { name, cells, columnMeta } = parsed.output;
	const hasCellUpdate = cells !== undefined || columnMeta !== undefined;

	// If only renaming (no cell data), use the simpler rename path
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

	return json({ error: 'No update fields provided.' }, { status: 400 });
};

/** Delete a file (cascades to detail table). */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);
	const row = await deleteFile(params.id, user.id);
	if (!row) return json({ error: 'Not found.' }, { status: 404 });
	return json({ success: true });
};
