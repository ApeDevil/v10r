import { type Handle, type HandleServerError, error, json, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { auth } from '$lib/server/auth';
import { AUTH_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW, HSTS_MAX_AGE } from '$lib/server/config';
import { logFeatureStatus } from '$lib/server/features';
import { getCustomPaletteById } from '$lib/server/branding/palette-crud';
import { getBrandConfig } from '$lib/server/style/brand';
import {
	generateRandomStyle,
	parseStyleCookie,
	resolveStyle,
	serializeStyleCookie,
	STYLE_COOKIE_NAME,
	STYLE_COOKIE_OPTIONS,
} from '$lib/styles/random';
import { deriveAccentTokens } from '$lib/styles/random/accent';
import type { PaletteId, ResolvedStyle } from '$lib/styles/random/types';
import { getTypography } from '$lib/styles/random/typography-registry';
import { getRadius } from '$lib/styles/random/radius-registry';
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

/** Allowlisted token keys for CSS injection (from PaletteColors interface) */
const VALID_TOKEN_KEYS = new Set([
	'bg', 'fg', 'body', 'heading', 'muted', 'border', 'subtle',
	'primary', 'primary-hover', 'primary-container', 'on-primary-container',
	'primary-dim', 'on-primary', 'secondary', 'on-secondary',
	'accent', 'accent-hover', 'on-accent', 'accent-container', 'on-accent-container',
	'input', 'input-border', 'surface-1', 'surface-2', 'surface-3',
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
		resolved = resolveStyle(config)!;
	}

	// Set cookie if changed
	const serialized = serializeStyleCookie(config!);
	if (cookieValue !== serialized) {
		event.cookies.set(STYLE_COOKIE_NAME, serialized, STYLE_COOKIE_OPTIONS);
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
			transformPageChunk: ({ html }) => {
				let result = html
					.replace('%lang%', safeLocale)
					.replace('%palette%', event.locals.style?.paletteId ?? '')
					.replace('%typography%', event.locals.style?.typographyId ?? '')
					.replace('%radius%', event.locals.style?.radiusId ?? '');

				// Inject custom palette CSS vars for CP_ palettes
				const cp = event.locals.customPaletteColors;
				if (cp && event.locals.style?.paletteId) {
					const pid = event.locals.style.paletteId;
					const toVar = (k: string) =>
						k.startsWith('surface-') ? `--${k}` : `--color-${k}`;
					const safeEntries = (colors: Record<string, string>) =>
						Object.entries(colors).filter(
							([k, v]) => VALID_TOKEN_KEYS.has(k) && OKLCH_RE.test(v),
						);

					// Derive accent tokens from primary + offset (only for tokens not explicitly set)
					const accentOffset = event.locals.customPaletteAccentOffset ?? 0;
					const lightAccent = cp.light.primary
						? deriveAccentTokens(cp.light.primary, accentOffset)
						: {};
					const darkAccent = cp.dark.primary
						? deriveAccentTokens(cp.dark.primary, accentOffset)
						: {};

					// Admin-set accent tokens win over derived ones
					const lightExplicit = new Set(safeEntries(cp.light).map(([k]) => k));
					const darkExplicit = new Set(safeEntries(cp.dark).map(([k]) => k));

					const lightVars = [
						...safeEntries(cp.light),
						...Object.entries(lightAccent).filter(([k]) => !lightExplicit.has(k)),
					]
						.map(([k, v]) => `${toVar(k)}:${v}`)
						.join(';');
					const darkVars = [
						...safeEntries(cp.dark),
						...Object.entries(darkAccent).filter(([k]) => !darkExplicit.has(k)),
					]
						.map(([k, v]) => `${toVar(k)}:${v}`)
						.join(';');
					const style = `<style>[data-palette="${pid}"]{${lightVars}}.dark[data-palette="${pid}"]{${darkVars}}</style>`;
					result = result.replace('</head>', `${style}</head>`);
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
 * 7. Route guard — protect /app/* and /admin/* routes
 */
const routeGuard: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	if (path.startsWith('/app') || path.startsWith('/admin')) {
		if (!event.locals.user) {
			const returnTo = encodeURIComponent(path + event.url.search);
			redirect(303, `/auth/login?returnTo=${returnTo}`);
		}

		// Admin routes require admin privileges — return 404 to hide existence
		if (path.startsWith('/admin')) {
			const adminEmail = env.ADMIN_EMAIL;
			if (!adminEmail || event.locals.user.email.toLowerCase() !== adminEmail.toLowerCase()) {
				error(404, 'Not Found');
			}
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
