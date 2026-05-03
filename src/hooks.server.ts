import { error, type Handle, type HandleServerError, json } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { locales } from '$lib/i18n';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { parseConsentTier } from '$lib/server/analytics/consent';
import { analyticsCollector } from '$lib/server/analytics/hook';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { auth } from '$lib/server/auth';
import { getCustomPaletteById } from '$lib/server/branding/palette-crud';
import {
	ANALYTICS_CONSENT_COOKIE,
	AUTH_RATE_LIMIT_MAX,
	AUTH_RATE_LIMIT_WINDOW,
	HSTS_MAX_AGE,
} from '$lib/server/config';
import { logFeatureStatus } from '$lib/server/features';
import { clearOwnerCookie, PAIRING_COOKIE, verifyOwnerCookie } from '$lib/server/pairing/cookie';
import { getBrandConfig } from '$lib/server/style/brand';
import {
	generateRandomStyle,
	parseStyleCookie,
	resolveStyle,
	STYLE_COOKIE_NAME,
	STYLE_COOKIE_OPTIONS,
	serializeStyleCookie,
} from '$lib/styles/random';
import { deriveAccentTokens } from '$lib/styles/random/accent';
import { getRadius } from '$lib/styles/random/radius-registry';
import type { PaletteId, ResolvedStyle } from '$lib/styles/random/types';
import { getTypography } from '$lib/styles/random/typography-registry';
import '$lib/server/jobs/scheduler';
import '$lib/server/jobs/delivery-scheduler';

logFeatureStatus();

const ALLOWED_LOCALES = new Set<string>(locales);

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

/** Allowlisted token keys for CSS injection (from PaletteColors interface) */
const VALID_TOKEN_KEYS = new Set([
	'bg',
	'fg',
	'body',
	'heading',
	'muted',
	'border',
	'subtle',
	'primary',
	'primary-hover',
	'primary-container',
	'on-primary-container',
	'primary-dim',
	'on-primary',
	'secondary',
	'on-secondary',
	'accent',
	'accent-hover',
	'on-accent',
	'accent-container',
	'on-accent-container',
	'input',
	'input-border',
	'surface-1',
	'surface-2',
	'surface-3',
]);
const OKLCH_RE = /^oklch\(\s*[\d.]+\s+[\d.]+\s+[\d.]+\s*\)$/;

/**
 * 2. loadStyle — reads/generates style from cookie, populates event.locals.style
 */
const loadStyle: Handle = async ({ event, resolve }) => {
	const cookieValue = event.cookies.get(STYLE_COOKIE_NAME);
	let config = parseStyleCookie(cookieValue);
	let resolved: ResolvedStyle | null = null;

	// Brand override — always checked, even with valid cookie (0ms cached)
	let brand: Awaited<ReturnType<typeof getBrandConfig>> = null;
	try {
		brand = await getBrandConfig();
	} catch {
		// DB unreachable — fall through to cookie/random style
	}

	if (brand?.enabled) {
		config = { ...brand.style };
	}

	// Resolve: CP_ path (async DB lookup) vs registry path (sync)
	if (config?.paletteId?.startsWith('CP_')) {
		try {
			const cp = await getCustomPaletteById(config.paletteId);
			if (cp) {
				const typography = getTypography(config.typographyId);
				const radius = getRadius(config.radiusId);
				if (typography && radius) {
					resolved = {
						paletteId: config.paletteId as PaletteId,
						typographyId: config.typographyId,
						radiusId: config.radiusId,
						paletteName: cp.name,
						typographyName: typography.name,
						radiusName: radius.name,
						...(brand?.enabled ? { branded: true } : {}),
					};
					event.locals.customPaletteColors = {
						light: cp.lightColors as Record<string, string>,
						dark: cp.darkColors as Record<string, string>,
					};
					event.locals.customPaletteAccentOffset = cp.accentOffset ?? 0;
				}
			}
		} catch {
			// Custom palette not found or DB error — fall through to random
		}
	} else if (config) {
		resolved = resolveStyle(config);
		if (brand?.enabled && resolved) {
			resolved = { ...resolved, branded: true };
		}
	}

	// Fallback: no valid resolution → random
	if (!resolved) {
		config = generateRandomStyle();
		const fallback = resolveStyle(config);
		if (!fallback) throw new Error('Failed to resolve random style');
		resolved = fallback;
	}

	// Set cookie if changed
	if (!config) throw new Error('Style config missing after resolution');
	const serialized = serializeStyleCookie(config);
	if (cookieValue !== serialized) {
		event.cookies.set(STYLE_COOKIE_NAME, serialized, STYLE_COOKIE_OPTIONS);
	}

	event.locals.style = resolved;
	return resolve(event);
};

/**
 * 3. i18n — Paraglide locale detection + HTML lang attribute + style attrs
 *
 * Stamps event.locals.locale (canonical adapter handoff so domain code never
 * imports from $lib/paraglide). Persists URL-resolved locale to the
 * PARAGLIDE_LOCALE cookie when it diverges, so later non-prefixed requests
 * resolve consistently (Paraglide v2 does not auto-write on URL resolution).
 */
const i18n: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		const safeLocale = (ALLOWED_LOCALES.has(locale) ? locale : 'en') as App.Locals['locale'];
		event.locals.locale = safeLocale;
		// Skip Set-Cookie when the resolved locale equals baseLocale AND no cookie
		// is present yet — avoids polluting CDN-cacheable responses for first-visit
		// anonymous users on the default locale.
		const existingCookie = event.cookies.get('PARAGLIDE_LOCALE');
		const isDefaultFirstVisit = existingCookie === undefined && safeLocale === 'en';
		if (!isDefaultFirstVisit && existingCookie !== safeLocale) {
			event.cookies.set('PARAGLIDE_LOCALE', safeLocale, {
				path: '/',
				httpOnly: false,
				secure: typeof process !== 'undefined' ? process.env.NODE_ENV === 'production' : true,
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 * 365,
			});
		}
		event.request = request;

		// Hoist all per-response derivations OUT of the per-chunk callback. The
		// callback used to recompute the custom-palette <style> block (including
		// two culori-backed deriveAccentTokens calls) on every HTML chunk. Now it
		// is computed once and only injected when the </head> marker passes.
		const style = event.locals.style;
		const paletteId = style?.paletteId ?? '';
		const typographyId = style?.typographyId ?? '';
		const radiusId = style?.radiusId ?? '';

		let customPaletteStyle = '';
		const cp = event.locals.customPaletteColors;
		if (cp && paletteId) {
			const toVar = (k: string) => (k.startsWith('surface-') ? `--${k}` : `--color-${k}`);
			const safeEntries = (colors: Record<string, string>) =>
				Object.entries(colors).filter(([k, v]) => VALID_TOKEN_KEYS.has(k) && OKLCH_RE.test(v));

			const accentOffset = event.locals.customPaletteAccentOffset ?? 0;
			const lightAccent = cp.light.primary ? deriveAccentTokens(cp.light.primary, accentOffset) : {};
			const darkAccent = cp.dark.primary ? deriveAccentTokens(cp.dark.primary, accentOffset) : {};

			const lightExplicit = new Set(safeEntries(cp.light).map(([k]) => k));
			const darkExplicit = new Set(safeEntries(cp.dark).map(([k]) => k));

			const lightVars = [
				...safeEntries(cp.light),
				...Object.entries(lightAccent).filter(([k]) => !lightExplicit.has(k)),
			]
				.map(([k, v]) => `${toVar(k)}:${v}`)
				.join(';');
			const darkVars = [...safeEntries(cp.dark), ...Object.entries(darkAccent).filter(([k]) => !darkExplicit.has(k))]
				.map(([k, v]) => `${toVar(k)}:${v}`)
				.join(';');
			const safePid = paletteId.replace(/[^a-zA-Z0-9_-]/g, '');
			customPaletteStyle = `<style>[data-palette="${safePid}"]{${lightVars}}.dark[data-palette="${safePid}"]{${darkVars}}</style>`;
		}

		return resolve(event, {
			transformPageChunk: ({ html }) => {
				let result = html
					.replace('%lang%', safeLocale)
					.replace('%palette%', paletteId)
					.replace('%typography%', typographyId)
					.replace('%radius%', radiusId);
				if (customPaletteStyle && result.includes('</head>')) {
					result = result.replace('</head>', `${customPaletteStyle}</head>`);
				}
				return result;
			},
		});
	});

/**
 * 4. Auth API handler — intercepts /api/auth/* routes
 *    Includes Upstash rate limiting on all auth endpoints
 */
const authHandler: Handle = async ({ event, resolve }) => {
	// During prerender there is no client — getClientAddress() throws. Skip rate-limit/IP injection.
	if (building) {
		return svelteKitHandler({ event, resolve, auth, building });
	}

	const path = event.url.pathname;

	// Rate limit all auth endpoints (sign-in, sign-out, callback, get-session)
	if (path.startsWith('/api/auth/')) {
		const ip = event.getClientAddress();
		const { success, reset } = await authRatelimit.limit(ip);

		if (!success) {
			return rateLimitResponse(reset, 'Too many requests. Please try again later.');
		}
	}

	// Inject x-client-ip so Better Auth's built-in rate limiting works behind proxies
	event.request.headers.set('x-client-ip', event.getClientAddress());

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
 * 6. CSRF protection — require X-Requested-With on mutating API calls.
 *    Exempt prefixes carry their own auth (Better Auth, Bearer, HMAC, beacon).
 */
const CSRF_EXEMPT_PREFIXES = [
	'/api/auth/', // Better Auth (own CSRF)
	'/api/cron/', // Vercel cron + Bearer token
	'/api/webhooks/', // Third-party webhooks (HMAC signature)
	'/api/analytics/journey', // navigator.sendBeacon (no custom headers possible)
] as const;

const csrfProtection: Handle = async ({ event, resolve }) => {
	const method = event.request.method;
	const path = event.url.pathname;

	if (
		(method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') &&
		path.startsWith('/api/') &&
		!CSRF_EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix))
	) {
		if (!event.request.headers.get('x-requested-with')) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}
	}

	return resolve(event);
};

/**
 * 6b. Consent loader — populate event.locals.consentTier from cookie. Defaults to
 *     'necessary'. Lives before routeGuard so admin pages also have a consistent value.
 */
const consentLoader: Handle = async ({ event, resolve }) => {
	event.locals.consentTier = parseConsentTier(event.cookies.get(ANALYTICS_CONSENT_COOKIE));
	return resolve(event);
};

/**
 * 6c. Debug-owner loader — verifies the v10r_debug_owner HMAC cookie and stamps
 *     locals.debugOwnerId so the analyticsCollector can attribute events to the
 *     paired admin. Independent of Better Auth — the phone is not logged in.
 */
const debugOwnerLoader: Handle = async ({ event, resolve }) => {
	const raw = event.cookies.get(PAIRING_COOKIE);
	if (!raw) {
		event.locals.debugOwnerId = null;
		return resolve(event);
	}
	try {
		const verified = await verifyOwnerCookie(raw);
		if (verified && verified.expiresAt > Date.now()) {
			event.locals.debugOwnerId = verified.adminUserId;
		} else {
			event.locals.debugOwnerId = null;
			clearOwnerCookie(event.cookies);
		}
	} catch {
		// PAIRING_SECRET missing or other crypto failure — fail closed, don't crash.
		event.locals.debugOwnerId = null;
	}
	return resolve(event);
};

/**
 * 7. Dev route guard — hide (dev) routes outside dev.
 * Member and admin auth gates live in app/+layout.server.ts and admin/+layout.server.ts.
 */
const devRouteGuard: Handle = async ({ event, resolve }) => {
	if (!import.meta.env.DEV && event.route.id?.startsWith('/(dev)/')) {
		error(404, 'Not Found');
	}
	return resolve(event);
};

export const handle = sequence(
	securityHeaders,
	loadStyle,
	i18n,
	authHandler,
	sessionPopulate,
	csrfProtection,
	consentLoader,
	debugOwnerLoader,
	devRouteGuard,
	analyticsCollector,
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
