import * as m from '$lib/paraglide/messages';
import { baseLocale, cookieName, isLocale } from '$lib/paraglide/runtime';
import type { RequestHandler } from './$types';

/**
 * Web app manifest — dynamic so name/description localize via the Paraglide
 * cookie locale (the <link rel="manifest"> carries credentials via
 * crossorigin="use-credentials" in app.html; without it this endpoint would
 * never see the locale cookie).
 *
 * The cookie is parsed from the RAW header — twice removed from the obvious
 * `locals.locale`: (1) the 'url' strategy resolves this unprefixed path as the
 * base locale before the cookie strategy is consulted, and (2) the middleware
 * then RE-WRITES the locale cookie to that resolved value during the request,
 * so `cookies.get()` returns the overwritten 'en', not what the browser sent.
 *
 * id/start_url stay locale-invariant: one install identity per origin.
 */
export const GET: RequestHandler = async ({ request }) => {
	const rawCookies = request.headers.get('cookie') ?? '';
	const cookieLocale = new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`).exec(rawCookies)?.[1];
	const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : baseLocale;

	const manifest = {
		id: '/',
		name: m.pwa_manifest_name({}, { locale }),
		short_name: m.pwa_manifest_short_name({}, { locale }),
		description: m.pwa_manifest_description({}, { locale }),
		start_url: '/',
		scope: '/',
		display: 'standalone',
		// Safari ignores display_override (falls back to display) — safe everywhere.
		display_override: ['standalone', 'browser'],
		lang: locale,
		// --color-bg (light) resolved to sRGB; manifest colors are install-time
		// snapshots — live status-bar tinting comes from the theme-color metas.
		background_color: '#cfd9e1',
		theme_color: '#cfd9e1',
		icons: [
			{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
			{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
			{ src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
			{ src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
		],
	};

	return new Response(JSON.stringify(manifest), {
		headers: {
			'Content-Type': 'application/manifest+json',
			// private (not public): the body is cookie-localized. An explicit value
			// also keeps the securityHeaders hook from stamping no-store for
			// logged-in users.
			'Cache-Control': 'private, max-age=3600',
		},
	});
};
