/**
 * The site's canonical URL, resolved from `BETTER_AUTH_URL`.
 *
 * One value states where the deployment lives, and everything that must name it absolutely
 * derives from it: Better Auth's `baseURL` and trusted origin, the passkey relying-party id, the
 * Discord OAuth redirect URI, the Web Push contact. It is never taken from a request: a `Host`
 * header is client-chosen, and the callbacks registered with OAuth providers must match one
 * fixed value exactly.
 *
 * Unset in `dev`, it is the Vite dev server compose.yaml publishes, so a local `.env` needs no
 * entry. Unset anywhere else, it throws at import — a production origin cannot be guessed:
 * Vercel's `VERCEL_PROJECT_PRODUCTION_URL` names the shortest custom domain, and on this project
 * that is the apex `v10r.dev`, which only redirects to the canonical `www`. `dev` is the build-mode
 * constant, not `NODE_ENV`, so a deploy cannot fall into the localhost default by a stray variable.
 *
 * Pure (no `$app/*`): `auth/index.ts` passes the variable and `dev` in.
 */

/** The Vite dev server's default origin — the port compose.yaml publishes. */
export const DEV_SITE_URL = 'http://localhost:5173';

export function resolveSiteUrl(configured: string | undefined, isDev: boolean): URL {
	if (configured) return new URL(configured);
	if (isDev) return new URL(DEV_SITE_URL);
	throw new Error(
		'Missing required environment variable: BETTER_AUTH_URL — the canonical site URL, e.g. https://www.example.com',
	);
}
