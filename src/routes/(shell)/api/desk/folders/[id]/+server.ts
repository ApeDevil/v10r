import * as v from 'valibot';
import { safeParse } from 'valibot';
import { apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { deleteFolder, moveFolder, renameFolder } from '$lib/server/db/desk/mutations';
import { countFolderContents, getFolder } from '$lib/server/db/desk/queries';
import type { RequestHandler } from './$types';

const UpdateFolderSchema = v.object({
	name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
	parentId: v.optional(v.nullable(v.string())),
});

/** Get a single folder. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);
	const row = await getFolder(params.id, user.id);
	if (!row) return apiError(404, 'not_found', 'Folder not found.');
	return apiOk({ folder: row });
};

/** Update folder (rename and/or move). */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const { user } = requireApiUser(locals);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Invalid request body.');

	const parsed = safeParse(UpdateFolderSchema, body);
	if (!parsed.success) {
		return apiValidationError(parsed.issues);
	}

	const { name, parentId } = parsed.output;

	// Handle move first (can throw on cycle)
	if (parentId !== undefined) {
		try {
			const row = await moveFolder(params.id, user.id, parentId);
			if (!row) return apiError(404, 'not_found', 'Folder not found.');
		} catch (e) {
			return apiError(400, 'move_failed', (e as Error).message);
		}
	}

	// Handle rename
	if (name !== undefined) {
		const row = await renameFolder(params.id, user.id, name);
		if (!row) return apiError(404, 'not_found', 'Folder not found.');
		return apiOk({ folder: row });
	}

	// If only moved (no rename), re-fetch
	const row = await getFolder(params.id, user.id);
	return apiOk({ folder: row });
};

/** Delete a folder (cascades to subfolders). */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);

	const childCount = await countFolderContents(params.id, user.id);
	const row = await deleteFolder(params.id, user.id);
	if (!row) return apiError(404, 'not_found', 'Folder not found.');
	return apiOk({ success: true, childCount });
};
