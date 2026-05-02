import * as v from 'valibot';
import { safeParse } from 'valibot';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import {
	FolderCycleError,
	FolderNameConflictError,
	FolderNotEmptyError,
	FolderNotFoundError,
} from '$lib/server/db/desk/errors';
import { deleteFolder, moveFolder, renameFolder } from '$lib/server/db/desk/mutations';
import { getFolder } from '$lib/server/db/desk/queries';
import type { RequestHandler } from './$types';

// Raised from 30/min — drag-drop bursts are legitimate user intent, not abuse.
const limiter = createLimiter('rl:desk:folders:mutate', 60, '1 m');

const UpdateFolderSchema = v.object({
	name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
	parentId: v.optional(v.nullable(v.string())),
});

/** Get a single folder. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);
	const row = await getFolder(params.id, user.id);
	if (!row) return apiError(404, 'folder_not_found', 'Folder not found.');
	return apiOk({ folder: row });
};

/** Update folder (rename and/or move). */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Invalid request body.');

	const parsed = safeParse(UpdateFolderSchema, body);
	if (!parsed.success) {
		return apiValidationError(parsed.issues);
	}

	const { name, parentId } = parsed.output;

	try {
		if (parentId !== undefined) {
			await moveFolder(params.id, user.id, parentId);
		}
		if (name !== undefined) {
			const row = await renameFolder(params.id, user.id, name);
			return apiOk({ folder: row });
		}
		const row = await getFolder(params.id, user.id);
		return apiOk({ folder: row });
	} catch (e) {
		if (e instanceof FolderNotFoundError) {
			return apiError(404, e.code, e.message, { folderId: e.folderId });
		}
		if (e instanceof FolderCycleError) {
			return apiError(409, e.code, e.message, {
				folderId: e.folderId,
				targetParentId: e.targetParentId,
			});
		}
		if (e instanceof FolderNameConflictError) {
			return apiError(409, e.code, e.message, {
				parentId: String(e.parentId ?? ''),
				name: e.name,
				suggestedName: e.suggestedName,
			});
		}
		throw e;
	}
};

/**
 * Delete a folder.
 *
 * Default (non-recursive) fails with 409 `folder_not_empty` if the folder has any children —
 * defense in depth against non-UI callers (AI tools, API clients). Pass `?recursive=true`
 * after explicit user confirmation in the UI.
 */
export const DELETE: RequestHandler = async ({ params, url, locals }) => {
	const { user } = requireApiUser(locals);

	const { success: rlOk, reset } = await limiter.limit(user.id);
	if (!rlOk) return rateLimitResponse(reset);

	const recursive = url.searchParams.get('recursive') === 'true';

	try {
		const result = await deleteFolder(params.id, user.id, { recursive });
		return apiOk({ id: result.id, deletedCount: result.deletedIds.length });
	} catch (e) {
		if (e instanceof FolderNotFoundError) {
			return apiError(404, e.code, e.message, { folderId: e.folderId });
		}
		if (e instanceof FolderNotEmptyError) {
			return apiError(409, e.code, e.message, {
				folderId: e.folderId,
				childCount: String(e.childCount),
			});
		}
		throw e;
	}
};
