import * as v from 'valibot';
import { safeParse } from 'valibot';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiCreated, apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { FolderNameConflictError } from '$lib/server/db/desk/errors';
import { createFolder } from '$lib/server/db/desk/mutations';
import { listFolders } from '$lib/server/db/desk/queries';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:desk:folders', 10, '1 m');

const CreateFolderSchema = v.object({
	name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
	parentId: v.optional(v.nullable(v.string())),
});

/**
 * List all folders for the user (flat).
 *
 * Unpaginated by design — a paginated tree is unrenderable. Capped server-side
 * at `FOLDER_LIST_CAP`; if exceeded, `overflow: true` signals the overflow.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const { user } = requireApiUser(locals);
	const { items, overflow } = await listFolders(user.id);
	return apiOk({ folders: items, overflow });
};

/** Create a new folder. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => ({}));
	const parsed = safeParse(CreateFolderSchema, body);
	if (!parsed.success) {
		return apiValidationError(parsed.issues);
	}

	const { name, parentId } = parsed.output;
	try {
		const row = await createFolder(user.id, name, parentId ?? null);
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
