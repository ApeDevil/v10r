import * as v from 'valibot';
import { safeParse } from 'valibot';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiCreated, apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import { requireApiAuthor } from '$lib/server/auth/guards';
import { createAssetFolder, listAssetFolders } from '$lib/server/blog/asset-folders';
import { FolderNameConflictError } from '$lib/server/db/shared/folder-tree';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:blog:asset-folders', 10, '1 m');

const CreateAssetFolderSchema = v.object({
	name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
	parentId: v.optional(v.nullable(v.string())),
});

/** List all blog asset folders for the current author (flat, unpaginated, ≤500). */
export const GET: RequestHandler = async ({ locals }) => {
	const { user } = requireApiAuthor(locals);
	const { items, overflow } = await listAssetFolders(user.id);
	return apiOk({ folders: items, overflow });
};

/** Create a new blog asset folder. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiAuthor(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => ({}));
	const parsed = safeParse(CreateAssetFolderSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	const { name, parentId } = parsed.output;
	try {
		const row = await createAssetFolder(user.id, name, parentId ?? null);
		return apiCreated({ folder: row });
	} catch (e) {
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
