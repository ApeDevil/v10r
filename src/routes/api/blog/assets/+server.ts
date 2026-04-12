import * as v from 'valibot';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiPaginated, parsePagination } from '$lib/server/api/pagination';
import { apiCreated, apiError, apiValidationError } from '$lib/server/api/response';
import { requireApiAuthor } from '$lib/server/auth/guards';
import { listAssets } from '$lib/server/blog';
import { RequestUploadSchema } from '$lib/server/blog/schemas';
import {
	BLOG_WRITE_RATE_LIMIT_MAX,
	BLOG_WRITE_RATE_LIMIT_PREFIX,
	BLOG_WRITE_RATE_LIMIT_WINDOW,
} from '$lib/server/config';
import { generateBlogDownloadUrl, generateBlogUploadUrl } from '$lib/server/store/blog';
import { classifyS3Error } from '$lib/server/store/errors';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(BLOG_WRITE_RATE_LIMIT_PREFIX, BLOG_WRITE_RATE_LIMIT_MAX, BLOG_WRITE_RATE_LIMIT_WINDOW);

/** List all assets for the current author, with download URLs. */
export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = requireApiAuthor(locals);
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
	const { user } = requireApiAuthor(locals);

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(RequestUploadSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	try {
		const result = await generateBlogUploadUrl(parsed.output.fileName, parsed.output.mimeType, parsed.output.fileSize);
		return apiCreated({ upload: result });
	} catch (err) {
		const storeErr = classifyS3Error(err);
		return apiError(storeErr.toStatus(), 'storage_error', storeErr.message);
	}
};
