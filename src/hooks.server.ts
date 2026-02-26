import { sequence } from '@sveltejs/kit/hooks';
import { json, redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '$lib/server/cache';
import '$lib/server/jobs/scheduler';

const ALLOWED_LOCALES = new Set(['en', 'de', 'fr']);

/** Upstash rate limiter for auth endpoints: 5 requests per 60s per IP */
const authRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(5, '60 s'),
	prefix: 'ratelimit:auth',
});

/**
 * 1. Security headers — applied to every response
 */
const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set(
		'Permissions-Policy',
		'camera=(), microphone=(), geolocation=()',
	);
	response.headers.set(
		'Strict-Transport-Security',
		'max-age=63072000; includeSubDomains; preload',
	);

	return response;
};

/**
 * 2. i18n — Paraglide locale detection + HTML lang attribute
 */
const i18n: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		const safeLocale = ALLOWED_LOCALES.has(locale) ? locale : 'en';
		event.request = request;
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%lang%', safeLocale),
		});
	});

/**
 * 3. Auth API handler — intercepts /api/auth/* routes
 *    Includes Upstash rate limiting on all auth endpoints
 */
const authHandler: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	// Rate limit all auth endpoints (sign-in, sign-out, callback, get-session)
	if (path.startsWith('/api/auth/')) {
		const ip = event.getClientAddress();
		const { success, reset } = await authRatelimit.limit(ip);

		if (!success) {
			return json(
				{ error: 'Too many requests. Please try again later.' },
				{
					status: 429,
					headers: {
						'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
					},
				},
			);
		}
	}

	return svelteKitHandler({ event, resolve, auth });
};

/**
 * 4. Session populate — reads session from cookie/headers into event.locals
 *    CRITICAL: svelteKitHandler does NOT populate event.locals (Issue #2188)
 */
const sessionPopulate: Handle = async ({ event, resolve }) => {
	const sessionData = await auth.api.getSession({
		headers: event.request.headers,
	});

	event.locals.user = sessionData?.user ?? null;
	event.locals.session = sessionData?.session ?? null;

	return resolve(event);
};

/**
 * 5. Route guard — protect /app/* routes
 */
const routeGuard: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/app')) {
		if (!event.locals.user) {
			const returnTo = encodeURIComponent(event.url.pathname + event.url.search);
			redirect(303, `/auth/login?returnTo=${returnTo}`);
		}
	}

	return resolve(event);
};

export const handle = sequence(
	securityHeaders,
	i18n,
	authHandler,
	sessionPopulate,
	routeGuard,
);

export const handleError: HandleServerError = ({ error, event, status, message }) => {
	// 404s from unknown routes — no errorId needed
	if (status === 404 && event.route.id === null) {
		return { message: 'Page not found' };
	}

	const errorId = crypto.randomUUID();

	console.error(
		JSON.stringify({
			errorId,
			status,
			path: event.url.pathname,
			route: event.route.id,
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		}),
	);

	return { message, errorId };
};
