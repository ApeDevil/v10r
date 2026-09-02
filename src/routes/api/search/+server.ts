/**
 * Public universal search — the palette's debounced server lane (full-body docs
 * + live blog FTS). Anonymous: IP-rate-limited, never auth-gated. Distinct from
 * the auth-gated retrieval endpoint `/api/retrieval/search`.
 */
import * as v from 'valibot';
import { type Locale, locales } from '$lib/i18n';
import { ipLimitKey } from '$lib/server/abuse';
import { getClientIp } from '$lib/server/http/client-ip';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiOk, apiValidationError } from '$lib/server/http/response';
import { searchContent } from '$lib/server/search';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:search', 40, '10 s');

const QuerySchema = v.object({
	q: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
	locale: v.optional(v.picklist(locales)),
	limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(50))),
	scope: v.optional(v.picklist(['all', 'docs', 'blog'])),
});

export const GET: RequestHandler = async (event) => {
	const { url, locals } = event;

	const { success, reset } = await limiter.limit(ipLimitKey(getClientIp(event)));
	if (!success) return rateLimitResponse(reset);

	const parsed = v.safeParse(QuerySchema, {
		q: url.searchParams.get('q') ?? '',
		locale: url.searchParams.get('locale') ?? undefined,
		limit: url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : undefined,
		scope: url.searchParams.get('scope') ?? undefined,
	});
	if (!parsed.success) return apiValidationError(parsed.issues);

	const { q, locale, limit, scope } = parsed.output;
	const activeLocale = (locale ?? locals.locale ?? 'en') as Locale;

	const items = await searchContent(q, { locale: activeLocale, limit: limit ?? 8, scope: scope ?? 'all' });

	// Public, anonymous, no Set-Cookie (loadStyle/analytics skip /api) → CDN-cacheable.
	// Identical (q, locale, scope) queries are shared across users; SWR keeps the edge
	// warm while revalidating. securityHeaders preserves an explicit Cache-Control.
	event.setHeaders({ 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' });
	return apiOk({ items });
};
