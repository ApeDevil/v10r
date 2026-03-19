import { type Handle, type HandleServerError, json, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { auth } from '$lib/server/auth';
import { AUTH_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW, HSTS_MAX_AGE } from '$lib/server/config';
import { logFeatureStatus } from '$lib/server/features';
import { getCorporateConfig } from '$lib/server/style/corporate';
import {
	generateRandomStyle,
	parseStyleCookie,
	resolveStyle,
	serializeStyleCookie,
	STYLE_COOKIE_NAME,
	STYLE_COOKIE_OPTIONS,
} from '$lib/styles/random';
import '$lib/server/jobs/scheduler';
import '$lib/server/jobs/delivery-scheduler';

logFeatureStatus();

const ALLOWED_LOCALES = new Set(['en', 'de', 'fr']);

/** Upstash rate limiter for auth endpoints */
const authRatelimit = createLimiter('ratelimit:auth', AUTH_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW);

/**
 * 1. Security headers — applied to every response
 */
const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set('Strict-Transport-Security', `max-age=${HSTS_MAX_AGE}; includeSubDomains; preload`);

	return response;
};

/**
 * 2. loadStyle — reads/generates style from cookie, populates event.locals.style
 */
const loadStyle: Handle = async ({ event, resolve }) => {
	const cookieValue = event.cookies.get(STYLE_COOKIE_NAME);
	let config = parseStyleCookie(cookieValue);
	let resolved = config ? resolveStyle(config) : null;

	// Corporate override — always checked, even with valid cookie (0ms cached)
	const corporate = await getCorporateConfig();
	if (corporate?.enabled) {
		config = { ...corporate.style };
		resolved = { ...resolveStyle(config)!, corporate: true };
		const serialized = serializeStyleCookie(config);
		if (cookieValue !== serialized) {
			event.cookies.set(STYLE_COOKIE_NAME, serialized, STYLE_COOKIE_OPTIONS);
		}
	} else if (!resolved) {
		// No valid cookie and no corporate → random
		config = generateRandomStyle();
		resolved = resolveStyle(config)!;
		event.cookies.set(STYLE_COOKIE_NAME, serializeStyleCookie(config), STYLE_COOKIE_OPTIONS);
	}

	event.locals.style = resolved;
	return resolve(event);
};

/**
 * 3. i18n — Paraglide locale detection + HTML lang attribute + style attrs
 */
const i18n: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		const safeLocale = ALLOWED_LOCALES.has(locale) ? locale : 'en';
		event.request = request;
		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%lang%', safeLocale)
					.replace('%palette%', event.locals.style?.paletteId ?? '')
					.replace('%typography%', event.locals.style?.typographyId ?? '')
					.replace('%radius%', event.locals.style?.radiusId ?? ''),
		});
	});

/**
 * 4. Auth API handler — intercepts /api/auth/* routes
 *    Includes Upstash rate limiting on all auth endpoints
 */
const authHandler: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	// Rate limit all auth endpoints (sign-in, sign-out, callback, get-session)
	if (path.startsWith('/api/auth/')) {
		const ip = event.getClientAddress();
		const { success, reset } = await authRatelimit.limit(ip);

		if (!success) {
			return rateLimitResponse(reset, 'Too many requests. Please try again later.');
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

/**
 * 5. Session populate — reads session from cookie/headers into event.locals
 *    CRITICAL: svelteKitHandler does NOT populate event.locals (Issue #2188)
 */
const sessionPopulate: Handle = async ({ event, resolve }) => {
	const cookies = event.request.headers.get('cookie');
	if (!cookies?.includes('better-auth.session_token')) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const sessionData = await auth.api.getSession({
		headers: event.request.headers,
	});

	event.locals.user = sessionData?.user ?? null;
	event.locals.session = sessionData?.session ?? null;

	return resolve(event);
};

/**
 * 6. CSRF protection — require X-Requested-With on mutating API calls
 *    Excludes /api/auth/* (Better Auth handles its own CSRF) and /api/cron/* (Bearer token)
 */
const csrfProtection: Handle = async ({ event, resolve }) => {
	const method = event.request.method;
	const path = event.url.pathname;

	if (
		(method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') &&
		path.startsWith('/api/') &&
		!path.startsWith('/api/auth/') &&
		!path.startsWith('/api/cron/') &&
		!path.startsWith('/api/telegram/')
	) {
		if (!event.request.headers.get('x-requested-with')) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}
	}

	return resolve(event);
};

/**
 * 7. Route guard — protect /app/* routes
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

export const handle = sequence(securityHeaders, loadStyle, i18n, authHandler, sessionPopulate, csrfProtection, routeGuard);

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
