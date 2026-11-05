import * as v from 'valibot';
import { safeParse } from 'valibot';
import { createRecordFile, createSpreadsheetFile } from '#lib/server/db/desk/mutations.ts';
import { listFiles } from '#lib/server/db/desk/queries.ts';
import { guardApiUser } from '#lib/server/http/guards.ts';
import { apiPaginated, parsePagination } from '#lib/server/http/pagination.ts';
import { createLimiter, rateLimitResponse } from '#lib/server/http/rate-limit.ts';
import { apiCreated, apiError, apiValidationError } from '#lib/server/http/response.ts';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:desk:files', 10, '1 m');

/** The file types a person creates empty. Markdown is created by import or by the assistant. */
const CreateFileSchema = v.object({
	type: v.picklist(['spreadsheet', 'record']),
	name: v.optional(v.pipe(v.string(), v.maxLength(200))),
	folderId: v.optional(v.nullable(v.string())),
});

/** List user's files, optionally filtered by ?type= */
export const GET: RequestHandler = async ({ url, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;
	const type = url.searchParams.get('type') ?? undefined;
	const pagination = parsePagination(url);
	const { items, total } = await listFiles(user.id, type, pagination.offset, pagination.pageSize);
	return apiPaginated(items, total, pagination);
};

/** Create a new file. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

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
	if (type === 'record') {
		const result = await createRecordFile(user.id, name, undefined, folderId ?? null);
		if (result.status === 'created') return apiCreated({ file: result.file, record: result.record });
	}

	return apiError(400, 'unsupported_type', 'Unsupported file type.');
};
