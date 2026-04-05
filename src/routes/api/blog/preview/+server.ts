import * as v from 'valibot';
import { requireApiAuthor } from '$lib/server/auth/guards';
import { renderBlogPost } from '$lib/server/blog';
import { PreviewSchema } from '$lib/server/blog/schemas';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiOk, apiError, apiValidationError } from '$lib/server/api/response';
import { BLOG_PREVIEW_RATE_LIMIT_PREFIX, BLOG_PREVIEW_RATE_LIMIT_MAX, BLOG_PREVIEW_RATE_LIMIT_WINDOW } from '$lib/server/config';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(BLOG_PREVIEW_RATE_LIMIT_PREFIX, BLOG_PREVIEW_RATE_LIMIT_MAX, BLOG_PREVIEW_RATE_LIMIT_WINDOW);

/** Render markdown preview (server-side pipeline). */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiAuthor(locals);

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(PreviewSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	try {
		const result = await renderBlogPost(parsed.output.markdown);
		return apiOk({
			html: result.html,
			embeds: result.embeds,
			toc: result.toc,
		});
	} catch {
		return apiError(500, 'render_failed', 'Preview rendering failed');
	}
};
