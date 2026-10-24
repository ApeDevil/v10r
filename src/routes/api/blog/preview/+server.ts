import * as v from 'valibot';
import {
	PREVIEW_RATE_LIMIT_MAX,
	PREVIEW_RATE_LIMIT_PREFIX,
	PREVIEW_RATE_LIMIT_WINDOW,
} from '#lib/server/blog/config.ts';
import { renderBlogPost } from '#lib/server/blog/index.ts';
import { PreviewSchema } from '#lib/server/blog/schemas.ts';
import { guardApiBlogAuthor } from '#lib/server/http/guards.ts';
import { createLimiter, rateLimitResponse } from '#lib/server/http/rate-limit.ts';
import { apiError, apiOk, apiValidationError } from '#lib/server/http/response.ts';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(PREVIEW_RATE_LIMIT_PREFIX, PREVIEW_RATE_LIMIT_MAX, PREVIEW_RATE_LIMIT_WINDOW);

/** Render markdown preview (server-side pipeline). */
export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = guardApiBlogAuthor(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

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
