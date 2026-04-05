import { json } from '@sveltejs/kit';
import * as v from 'valibot';
import { safeParse } from 'valibot';
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
	return json({ folders: rows });
};

/** Create a new folder. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiUser(locals);

	const body = await request.json().catch(() => ({}));
	const parsed = safeParse(CreateFolderSchema, body);
	if (!parsed.success) {
		return json({ error: 'Invalid request.' }, { status: 400 });
	}

	const { name, parentId } = parsed.output;
	const row = await createFolder(user.id, name, parentId ?? null);
	return json({ folder: row }, { status: 201 });
};
