import * as v from 'valibot';
import { safeParse } from 'valibot';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import { requireApiAuthor } from '$lib/server/auth/guards';
import {
	deletePostFolder,
	getPostFolder,
	movePostFolder,
	renamePostFolder,
} from '$lib/server/blog/post-folders';
import {
	FolderCycleError,
	FolderNameConflictError,
	FolderNotEmptyError,
	FolderNotFoundError,
} from '$lib/server/db/shared/folder-tree';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:blog:post-folders:mutate', 60, '1 m');

const UpdatePostFolderSchema = v.object({
	name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
	parentId: v.optional(v.nullable(v.string())),
});

export const GET: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiAuthor(locals);
	const row = await getPostFolder(params.id, user.id);
	if (!row) return apiError(404, 'folder_not_found', 'Folder not found.');
	return apiOk({ folder: row });
};

/** Rename and/or move a blog post folder. */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const { user } = requireApiAuthor(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Invalid request body.');

	const parsed = safeParse(UpdatePostFolderSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	const { name, parentId } = parsed.output;

	try {
		if (parentId !== undefined) {
			await movePostFolder(params.id, user.id, parentId);
		}
		if (name !== undefined) {
			const row = await renamePostFolder(params.id, user.id, name);
			return apiOk({ folder: row });
		}
		const row = await getPostFolder(params.id, user.id);
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

/** Delete a blog post folder. Pass `?recursive=true` to cascade. */
export const DELETE: RequestHandler = async ({ params, url, locals }) => {
	const { user } = requireApiAuthor(locals);

	const { success: rlOk, reset } = await limiter.limit(user.id);
	if (!rlOk) return rateLimitResponse(reset);

	const recursive = url.searchParams.get('recursive') === 'true';

	try {
		const result = await deletePostFolder(params.id, user.id, { recursive });
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
