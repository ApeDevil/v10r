import * as v from 'valibot';
import { safeParse } from 'valibot';
import { apiCreated, apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { createFolder } from '$lib/server/db/desk/mutations';
import { listFolders } from '$lib/server/db/desk/queries';
import type { RequestHandler } from './$types';

const CreateFolderSchema = v.object({
	name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
	parentId: v.optional(v.nullable(v.string())),
});

/** List all folders for the user (flat). */
export const GET: RequestHandler = async ({ locals }) => {
	const { user } = requireApiUser(locals);
	const rows = await listFolders(user.id);
	return apiOk({ folders: rows });
};

/** Create a new folder. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiUser(locals);

	const body = await request.json().catch(() => ({}));
	const parsed = safeParse(CreateFolderSchema, body);
	if (!parsed.success) {
		return apiValidationError(parsed.issues);
	}

	const { name, parentId } = parsed.output;
	const row = await createFolder(user.id, name, parentId ?? null);
	return apiCreated({ folder: row });
};
