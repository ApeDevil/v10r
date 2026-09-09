/**
 * Debug-owner cookie: signed marker that a phone session belongs to a specific
 * admin user for live-feed attribution. Independent of Better Auth sessions —
 * the phone is NOT logged in.
 *
 * The value is a `security/ticket` over `{ adminUserId }`, so the wire format,
 * the MAC and the expiry check all belong to that primitive rather than being
 * restated here. Note the payload is base64url — encoding, not encryption: the
 * admin's user id is still readable by anyone who can read the cookie. That was
 * true of the previous dotted format too, and is acceptable only because the
 * cookie is `HttpOnly` and grants attribution rather than authority.
 *
 * There is deliberately no revocation list. The cookie grants analytics
 * ATTRIBUTION only — `locals.debugOwnerId` never feeds an authz decision — so a
 * per-request Redis lookup to revoke a short-lived, admin-only debug marker
 * would cost every request for very little. Expiry is the control; keep it short.
 */
import { SUBKEY_PURPOSES, signTicket, verifyTicket } from '$lib/server/security';

export const PAIRING_COOKIE = 'v10r_debug_owner';

/**
 * Minimal structural stand-in for SvelteKit's `Cookies` — only the methods this
 * module actually calls (`set`/`delete`). Framework-free by design: a real
 * `Cookies` instance satisfies this structurally, so callers pass it unchanged.
 */
export interface CookieJar {
	set(
		name: string,
		value: string,
		opts: {
			path: string;
			httpOnly?: boolean;
			secure?: boolean;
			sameSite?: 'lax' | 'strict' | 'none';
			maxAge?: number;
		},
	): void;
	delete(name: string, opts: { path: string }): void;
}

export interface OwnerCookiePayload {
	adminUserId: string;
	expiresAt: number;
}

export function signOwnerCookie(adminUserId: string, expiresAt: number): string {
	return signTicket(SUBKEY_PURPOSES.pairingOwner, { adminUserId }, expiresAt);
}

/** Null for anything that is not a currently-valid cookie — tampered, expired, or malformed. */
export function verifyOwnerCookie(raw: string): OwnerCookiePayload | null {
	const check = verifyTicket<{ adminUserId: string }>(SUBKEY_PURPOSES.pairingOwner, raw);
	if (!check.ok || typeof check.fields.adminUserId !== 'string' || !check.fields.adminUserId) return null;
	return { adminUserId: check.fields.adminUserId, expiresAt: check.expiresAt };
}

export function setOwnerCookie(cookies: CookieJar, value: string, expiresAt: number): void {
	const maxAge = Math.max(1, Math.floor((expiresAt - Date.now()) / 1000));
	cookies.set(PAIRING_COOKIE, value, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge,
	});
}

export function clearOwnerCookie(cookies: CookieJar): void {
	cookies.delete(PAIRING_COOKIE, { path: '/' });
}
