import { json } from '@sveltejs/kit';
import { safeParse } from 'valibot';
import * as v from 'valibot';
import { requireApiUser } from '$lib/server/auth/guards';
import { createSpreadsheetFile } from '$lib/server/db/desk/mutations';
import { listFiles } from '$lib/server/db/desk/queries';
import type { RequestHandler } from './$types';

const CreateFileSchema = v.variant('type', [
	v.object({
		type: v.literal('spreadsheet'),
		name: v.optional(v.pipe(v.string(), v.maxLength(200))),
	}),
]);

/** List user's files, optionally filtered by ?type= */
export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = requireApiUser(locals);
	const type = url.searchParams.get('type') ?? undefined;
	const rows = await listFiles(user.id, type);
	return json({ files: rows });
};

/** Create a new file. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiUser(locals);

	const body = await request.json().catch(() => ({}));
	const parsed = safeParse(CreateFileSchema, body);
	if (!parsed.success) {
		return json({ error: 'Invalid request.' }, { status: 400 });
	}

	const { type, name } = parsed.output;

	if (type === 'spreadsheet') {
		const result = await createSpreadsheetFile(user.id, name);
		return json({ file: result.file, spreadsheet: result.spreadsheet }, { status: 201 });
	}

	return json({ error: 'Unsupported file type.' }, { status: 400 });
};
