/**
 * Reads the Better Auth session for a SvelteKit request, keeping the cookies the read writes.
 *
 * `auth.api.getSession()` is not a pure read. On a cookie-cache miss it loads the session
 * from Postgres and re-issues the signed `session_data` cache cookie; once `updateAge` has
 * passed it also re-issues `session_token` with a fresh Max-Age; for a session that no
 * longer exists it expires both. All of that is written to the endpoint's response
 * headers — which a direct `auth.api.*` call throws away unless it asks for them.
 *
 * Thrown away, the cache never refills: five minutes after sign-in every signed-in request
 * paid the session lookup again, and the extended session row was never matched by an
 * extended cookie. `returnHeaders: true` plus the forwarding below is what makes the
 * cookie cache actually cache.
 *
 * An adapter rather than a domain module because the destination is SvelteKit's cookie
 * jar. Better Auth's own `sveltekitCookies` plugin does the same forwarding, but reaches
 * the event through `$app/server`, which a module inside the auth domain may not import.
 */
import type { Cookies } from '@sveltejs/kit';
import { parseSetCookieHeader, toCookieOptions } from 'better-auth/cookies';
import { auth } from './index';

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;

/**
 * Copy every `Set-Cookie` in `headers` onto the SvelteKit cookie jar, so it leaves on the
 * response SvelteKit is building. Same mapping as Better Auth's `sveltekitCookies` plugin:
 * the parsed value is decoded and `cookies.set` re-encodes it, and `path` — which
 * SvelteKit requires — falls back to `/`.
 */
export function forwardSetCookies(headers: Headers | null | undefined, cookies: Pick<Cookies, 'set'>): void {
	const setCookie = headers?.get('set-cookie');
	if (!setCookie) return;
	for (const [name, attributes] of parseSetCookieHeader(setCookie)) {
		cookies.set(name, attributes.value, { ...toCookieOptions(attributes), path: attributes.path || '/' });
	}
}

/**
 * The session for this request, with any cookie refresh forwarded onto `event.cookies`.
 * Rejects exactly as `auth.api.getSession` does; the caller owns the degrade policy.
 */
export async function readRequestSession(event: {
	request: Request;
	cookies: Pick<Cookies, 'set'>;
}): Promise<SessionResult> {
	const { headers, response } = await auth.api.getSession({
		headers: event.request.headers,
		returnHeaders: true,
	});
	forwardSetCookies(headers, event.cookies);
	return response;
}
