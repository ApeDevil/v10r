import * as v from 'valibot';
import { safeParse } from 'valibot';
import { apiPaginated, parsePagination } from '$lib/server/api/pagination';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiCreated, apiValidationError } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { createFolder } from '$lib/server/db/desk/mutations';
import { listFolders } from '$lib/server/db/desk/queries';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:desk:folders', 10, '1 m');

const CreateFolderSchema = v.object({
	name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
	parentId: v.optional(v.nullable(v.string())),
});

/** List all folders for the user (flat). */
export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = requireApiUser(locals);
	const pagination = parsePagination(url);
	const { items, total } = await listFolders(user.id, pagination.offset, pagination.pageSize);
	return apiPaginated(items, total, pagination);
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
	const row = await createFolder(user.id, name, parentId ?? null);
	return apiCreated({ folder: row });
};
