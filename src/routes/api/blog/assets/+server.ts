import * as v from 'valibot';
import { WRITE_RATE_LIMIT_MAX, WRITE_RATE_LIMIT_PREFIX, WRITE_RATE_LIMIT_WINDOW } from '#lib/server/blog/config.ts';
import { listAssets } from '#lib/server/blog/index.ts';
import { RequestUploadSchema } from '#lib/server/blog/schemas.ts';
import { guardApiBlogAuthor } from '#lib/server/http/guards.ts';
import { apiPaginated, parsePagination } from '#lib/server/http/pagination.ts';
import { createLimiter, rateLimitResponse } from '#lib/server/http/rate-limit.ts';
import { apiCreated, apiError, apiValidationError } from '#lib/server/http/response.ts';
import { generateBlogDownloadUrl, generateBlogUploadUrl } from '#lib/server/store/blog/index.ts';
import { classifyS3Error } from '#lib/server/store/errors.ts';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(WRITE_RATE_LIMIT_PREFIX, WRITE_RATE_LIMIT_MAX, WRITE_RATE_LIMIT_WINDOW);

/** List all assets for the current author, with download URLs. */
export const GET: RequestHandler = async ({ url, locals }) => {
	const guard = guardApiBlogAuthor(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;
	const pagination = parsePagination(url);

	const { items: assets, total } = await listAssets(user.id, pagination.offset, pagination.pageSize);

	const items = await Promise.all(
		assets.map(async (a) => {
			let downloadUrl: string | null = null;
			try {
				const result = await generateBlogDownloadUrl(a.storageKey, 3600);
				downloadUrl = result.url;
			} catch {
				// R2 may not be configured — graceful degradation
			}
			return { ...a, downloadUrl };
		}),
	);

	return apiPaginated(items, total, pagination);
};

/** Request a presigned upload URL (step 1 of 3-step upload). */
export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = guardApiBlogAuthor(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(RequestUploadSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	try {
		const result = await generateBlogUploadUrl(
			user.id,
			parsed.output.fileName,
			parsed.output.mimeType,
			parsed.output.fileSize,
		);
		return apiCreated({ upload: result });
	} catch (err) {
		const storeErr = classifyS3Error(err);
		return apiError(storeErr.toStatus(), 'storage_error', storeErr.message);
	}
};
