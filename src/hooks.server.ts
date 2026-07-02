import { error, type Handle, type HandleServerError, json } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { cookieMaxAge, locales, cookieName as PARAGLIDE_LOCALE_COOKIE } from '$lib/i18n';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { checkEmailRateLimit, decisionResponse, logBlocked, verifyAltcha } from '$lib/server/abuse';
import { parseConsentTier } from '$lib/server/analytics/consent';
import { analyticsCollector } from '$lib/server/analytics/hook';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { auth } from '$lib/server/auth';
import { logAdminConfig } from '$lib/server/auth/admin-ids';
import { listActiveGrantKinds } from '$lib/server/auth/grants';
import { twoFactorVerifyLimitKey } from '$lib/server/auth/step-up';
import { getCustomPaletteById } from '$lib/server/branding/palette-crud';
import {
	ANALYTICS_CONSENT_COOKIE,
	AUTH_RATE_LIMIT_MAX,
	AUTH_RATE_LIMIT_WINDOW,
	HSTS_MAX_AGE,
	STEPUP_VERIFY_RATE_LIMIT_MAX,
	STEPUP_VERIFY_RATE_LIMIT_WINDOW,
} from '$lib/server/config';
import { logFeatureStatus } from '$lib/server/features';
import { clearOwnerCookie, PAIRING_COOKIE, verifyOwnerCookie } from '$lib/server/pairing/cookie';
import { isSameHost, needsCsrf } from '$lib/server/security/csrf';
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
import { safeEntries } from '$lib/styles/random/palette-sanitize';
import { getRadius } from '$lib/styles/random/radius-registry';
import type { PaletteId, ResolvedStyle } from '$lib/styles/random/types';
import { getTypography } from '$lib/styles/random/typography-registry';
import '$lib/server/agents';
import '$lib/server/jobs/scheduler';
import '$lib/server/jobs/delivery-scheduler';

logFeatureStatus();
logAdminConfig();

const ALLOWED_LOCALES = new Set<string>(locales);

/** Upstash rate limiter for auth endpoints */
const authRatelimit = createLimiter('ratelimit:auth', AUTH_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW);

/**
 * Per-ACCOUNT limiter for second-factor verification. The per-IP authRatelimit
 * alone is rotation-bypassable against a 6-digit TOTP space; these paths get a
 * second check keyed on the pending user.
 */
const twoFactorVerifyLimiter = createLimiter(
	'ratelimit:2fa:verify',
	STEPUP_VERIFY_RATE_LIMIT_MAX,
	STEPUP_VERIFY_RATE_LIMIT_WINDOW,
);

const TWO_FACTOR_VERIFY_PATHS = new Set([
	'/api/auth/two-factor/verify-totp',
	'/api/auth/two-factor/verify-backup-code',
	'/api/auth/two-factor/verify-otp',
]);

/**
 * 1. Security headers + canonical client IP stamp
 *
 * Stamps event.locals.clientIp and x-client-ip ONCE here, before any other
 * handler. Downstream code MUST read event.locals.clientIp (or x-client-ip
 * which Better Auth's ipAddressHeaders is pinned to) rather than re-deriving
 * from request headers — those are attacker-mutable until this handler runs.
 */
export const securityHeaders: Handle = async ({ event, resolve }) => {
	if (!building) {
		const ip = event.getClientAddress();
		event.locals.clientIp = ip;
		event.request.headers.set('x-client-ip', ip);
	} else {
		event.locals.clientIp = null;
	}

	const response = await resolve(event);

	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	response.headers.set('Strict-Transport-Security', `max-age=${HSTS_MAX_AGE}; includeSubDomains; preload`);
	// Cross-origin isolation (Spectre-class). same-origin-allow-popups keeps redirect/popup
	// OAuth flows working. COEP is intentionally NOT set (would require a CORP audit of
	// R2 / Carto / font origins). CORP same-site blocks cross-site resource hot-linking.
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
	response.headers.set('Cross-Origin-Resource-Policy', 'same-site');
	response.headers.set('X-DNS-Prefetch-Control', 'off');

	// Never cache user-specific or API responses on shared/intermediary caches.
	// The !has() guard preserves explicit Cache-Control set by a load/endpoint
	// (e.g. the data page's no-store, the blog-image proxy's public max-age).
	const isApi = event.url.pathname.startsWith('/api/');
	if ((event.locals.user || isApi) && !response.headers.has('Cache-Control')) {
		response.headers.set('Cache-Control', 'no-store, private');
	}

	// On logout, instruct the browser to purge cached pages, cookies, and storage
	// so a back-button after sign-out cannot reveal the prior session's data.
	if (event.url.pathname === '/api/auth/sign-out' && response.status >= 200 && response.status < 300) {
		response.headers.set('Clear-Site-Data', '"cache", "cookies", "storage"');
	}

	return response;
};

/**
 * 2. loadStyle — reads/generates style from cookie, populates event.locals.style
 */
const loadStyle: Handle = async ({ event, resolve }) => {
	// locals.style is consumed only by HTML rendering. Skip the cookie parse + brand
	// lookup on API routes (never render HTML) and SSR subrequests (internal fetches
	// that don't produce the app shell) — saves work on every such request.
	if (event.url.pathname.startsWith('/api/') || event.isSubRequest) {
		return resolve(event);
	}

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
 * 2b. Strip leading /en/ — base locale must not be URL-prefixed.
 *
 * Paraglide's URL pattern serves the base locale at unprefixed paths.
 * /en/foo has no canonical place to live; redirect to /foo (308 = permanent,
 * preserves method) so typed/shared URLs land on the canonical form and
 * search engines don't see duplicates.
 *
 * Scoped to startsWith('/en/') only — `/en` (no trailing slash) is preserved
 * because it currently matches a real SvelteKit route (separate concern).
 */
const stripBaseLocalePrefix: Handle = ({ event, resolve }) => {
	// Read only pathname up front. Destructuring `search`/`hash` here would
	// eagerly invoke those getters, and SvelteKit throws on `url.search`
	// during prerendering — crashing every prerendered page before the
	// /en/ check runs. Prerendered pages are never /en/-prefixed, so the
	// guarded access below is never reached at build time.
	const { pathname } = event.url;
	if (pathname.startsWith('/en/')) {
		const stripped = pathname.slice(3);
		return new Response(null, {
			status: 308,
			headers: { Location: stripped + event.url.search + event.url.hash },
		});
	}
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
		const existingCookie = event.cookies.get(PARAGLIDE_LOCALE_COOKIE);
		const isDefaultFirstVisit = existingCookie === undefined && safeLocale === 'en';
		if (!isDefaultFirstVisit && existingCookie !== safeLocale) {
			event.cookies.set(PARAGLIDE_LOCALE_COOKIE, safeLocale, {
				path: '/',
				httpOnly: false,
				secure: typeof process !== 'undefined' ? process.env.NODE_ENV === 'production' : true,
				sameSite: 'lax',
				maxAge: cookieMaxAge,
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
 * 3b. Auth captcha gate — verify ALTCHA token before email-sending auth routes.
 *     Token is sent via x-altcha-token header by the client (Better Auth
 *     fetchOptions.headers). We MUST verify here, not in form actions, because
 *     the Better Auth client posts JSON directly to /api/auth/* and form-action
 *     wrapping is not in the path.
 */
const AUTH_CAPTCHA_GATED_PATHS = new Set([
	'/api/auth/sign-in/magic-link',
	'/api/auth/email-otp/send-verification-otp',
	'/api/auth/two-factor/send-otp', // sends email — same abuse surface (body has no email; ALTCHA check still applies)
]);

const authCaptchaGate: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);
	if (event.request.method !== 'POST') return resolve(event);
	if (!AUTH_CAPTCHA_GATED_PATHS.has(event.url.pathname)) return resolve(event);

	const ctx = { route: event.url.pathname, clientIp: event.locals.clientIp };

	const captchaDecision = await verifyAltcha(event.request.headers.get('x-altcha-token'));
	if (!captchaDecision.allowed) {
		logBlocked(captchaDecision, ctx);
		return decisionResponse(captchaDecision);
	}

	// Read email from a clone so Better Auth can still consume the body.
	let email: string | null = null;
	try {
		const body = await event.request.clone().json();
		if (typeof body?.email === 'string') email = body.email;
	} catch {
		// Malformed body — Better Auth will reject; nothing to enforce here.
	}

	if (email) {
		const emailDecision = await checkEmailRateLimit(email);
		if (!emailDecision.allowed) {
			logBlocked(emailDecision, ctx);
			return decisionResponse(emailDecision);
		}
	}

	return resolve(event);
};

/**
 * 4. Auth API handler — intercepts /api/auth/* routes
 *    Includes Upstash rate limiting on all auth endpoints
 */
const authHandler: Handle = async ({ event, resolve }) => {
	// During prerender there is no client. Skip rate-limit. clientIp is null.
	if (building) {
		return svelteKitHandler({ event, resolve, auth, building });
	}

	const path = event.url.pathname;

	// Rate limit all auth endpoints (sign-in, sign-out, callback, get-session)
	if (path.startsWith('/api/auth/') && event.locals.clientIp) {
		const { success, reset } = await authRatelimit.limit(event.locals.clientIp);

		if (!success) {
			return rateLimitResponse(reset, 'Too many requests. Please try again later.');
		}
	}

	// Second-factor verify endpoints additionally rate-limit per ACCOUNT.
	// sessionPopulate runs after this handler (auth requests terminate here),
	// so the session is resolved inline for these rare paths only.
	if (TWO_FACTOR_VERIFY_PATHS.has(path)) {
		const sessionData = await auth.api.getSession({ headers: event.request.headers }).catch(() => null);
		const limitKey = twoFactorVerifyLimitKey(sessionData?.user.id, event.locals.clientIp);
		const { success, reset } = await twoFactorVerifyLimiter.limit(limitKey);

		if (!success) {
			return rateLimitResponse(reset, 'Too many verification attempts. Please wait before trying again.');
		}
	}

	// x-client-ip and Better Auth's ipAddressHeaders pinning happens in securityHeaders + auth config.

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
		event.locals.grants = [];
		return resolve(event);
	}

	const sessionData = await auth.api.getSession({
		headers: event.request.headers,
	});

	event.locals.user = sessionData?.user ?? null;
	event.locals.session = sessionData?.session ?? null;

	// Grants are read ONLY by the blog-author guards (the /api/blog/* authoring API and
	// blog pages). Skip the Neon round-trip on every other authed request — the array
	// stays empty and the guards still deny correctly (admins bypass via isAdmin). This
	// keeps `locals.grants` a plain array (no async cascade across ~25 guard call sites).
	const u = event.locals.user;
	if (u && (event.url.pathname.includes('/blog') || event.url.pathname.includes('/desk'))) {
		event.locals.grants = await listActiveGrantKinds(u.id);
	} else {
		event.locals.grants = [];
	}

	return resolve(event);
};

/**
 * 6. CSRF protection — defense in depth on mutating API calls. Predicates
 *    (needsCsrf / isSameHost / exempt set) live in $lib/server/security/csrf
 *    where they are unit-tested; this handler just wires them.
 */
const csrfProtection: Handle = async ({ event, resolve }) => {
	if (needsCsrf(event.request.method, event.url.pathname)) {
		if (!event.request.headers.get('x-requested-with')) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		const origin = event.request.headers.get('origin');
		const referer = event.request.headers.get('referer');
		const expectedHost = event.url.host;

		// Origin is the authoritative signal when present. Fall back to Referer for
		// clients that omit Origin on same-origin POSTs. If both are missing, reject.
		const ok = origin ? isSameHost(origin, expectedHost) : isSameHost(referer, expectedHost);
		if (!ok) {
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
	if (!import.meta.env.DEV && event.route.id?.includes('/(dev)/')) {
		error(404, 'Not Found');
	}
	return resolve(event);
};

export const handle = sequence(
	securityHeaders,
	stripBaseLocalePrefix,
	loadStyle,
	i18n,
	authCaptchaGate,
	authHandler,
	csrfProtection,
	sessionPopulate,
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
