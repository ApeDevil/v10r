import * as v from 'valibot';
import { safeParse } from 'valibot';
import { apiCreated, apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { createSpreadsheetFile } from '$lib/server/db/desk/mutations';
import { listFiles } from '$lib/server/db/desk/queries';
import type { RequestHandler } from './$types';

const CreateFileSchema = v.variant('type', [
	v.object({
		type: v.literal('spreadsheet'),
		name: v.optional(v.pipe(v.string(), v.maxLength(200))),
		folderId: v.optional(v.nullable(v.string())),
	}),
]);

/** List user's files, optionally filtered by ?type= */
export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = requireApiUser(locals);
	const type = url.searchParams.get('type') ?? undefined;
	const rows = await listFiles(user.id, type);
	return apiOk({ files: rows });
};

/** Create a new file. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiUser(locals);

	const body = await request.json().catch(() => ({}));
	const parsed = safeParse(CreateFileSchema, body);
	if (!parsed.success) {
		return apiValidationError(parsed.issues);
	}

	const { type, name, folderId } = parsed.output;

	if (type === 'spreadsheet') {
		const result = await createSpreadsheetFile(user.id, name, {}, folderId ?? null);
		return apiCreated({ file: result.file, spreadsheet: result.spreadsheet });
	}

	return apiError(400, 'unsupported_type', 'Unsupported file type.');
};
