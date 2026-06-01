/**
 * Public universal search — the palette's debounced server lane (full-body docs
 * + live blog FTS). Anonymous: IP-rate-limited, never auth-gated. Distinct from
 * the auth-gated RAG endpoint `/api/retrieval/search`.
 */
import * as v from 'valibot';
import type { SearchLocale } from '$lib/search/types';
import { getClientIp } from '$lib/server/abuse/client-ip';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiOk, apiValidationError } from '$lib/server/api/response';
import { searchContent } from '$lib/server/search';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:search', 40, '10 s');

const QuerySchema = v.object({
	q: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
	locale: v.optional(v.picklist(['en', 'de', 'ru'])),
	limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(50))),
	scope: v.optional(v.picklist(['all', 'docs', 'blog'])),
});

export const GET: RequestHandler = async (event) => {
	const { url, locals } = event;

	const ip = getClientIp(event);
	if (ip) {
		const { success, reset } = await limiter.limit(ip);
		if (!success) return rateLimitResponse(reset);
	}

	const parsed = v.safeParse(QuerySchema, {
		q: url.searchParams.get('q') ?? '',
		locale: url.searchParams.get('locale') ?? undefined,
		limit: url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : undefined,
		scope: url.searchParams.get('scope') ?? undefined,
	});
	if (!parsed.success) return apiValidationError(parsed.issues);

	const { q, locale, limit, scope } = parsed.output;
	const activeLocale = (locale ?? locals.locale ?? 'en') as SearchLocale;

	const items = await searchContent(q, { locale: activeLocale, limit: limit ?? 8, scope: scope ?? 'all' });
	return apiOk({ items });
};
