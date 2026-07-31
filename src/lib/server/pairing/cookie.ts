/**
 * Debug-owner cookie: HMAC-signed marker that a phone session belongs to a
 * specific admin user for live-feed attribution. Independent of Better Auth
 * sessions — the phone is NOT logged in.
 *
 * Format: `${userId}.${expMs}.${hex(hmac)}`
 *   where hmac = HMAC-SHA256(PAIRING_SECRET, `${userId}.${expMs}`)
 *
 * NOT base64url-wrapped, despite what this docblock claimed for a long time —
 * the value is the dotted string exactly as written above. Worth stating
 * plainly because it means the admin's user id travels in cleartext to anyone
 * who can read the cookie.
 *
 * There is deliberately no revocation list. The cookie grants analytics
 * ATTRIBUTION only — `locals.debugOwnerId` never feeds an authz decision — so a
 * per-request Redis lookup to revoke a short-lived, admin-only debug marker
 * would cost every request for very little. Expiry is the control; keep it short.
 */
import { env } from '$env/dynamic/private';

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

let cachedKey: CryptoKey | null = null;
async function getKey(): Promise<CryptoKey> {
	if (cachedKey) return cachedKey;
	const secret = env.PAIRING_SECRET;
	if (!secret) throw new Error('PAIRING_SECRET env var not set');
	cachedKey = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify'],
	);
	return cachedKey;
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}
function hexToBytes(hex: string): Uint8Array | null {
	if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) return null;
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
	return diff === 0;
}

export async function signOwnerCookie(adminUserId: string, expiresAt: number): Promise<string> {
	const payload = `${adminUserId}.${expiresAt}`;
	const key = await getKey();
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
	return `${payload}.${bytesToHex(new Uint8Array(sig))}`;
}

export async function verifyOwnerCookie(raw: string): Promise<OwnerCookiePayload | null> {
	const parts = raw.split('.');
	if (parts.length !== 3) return null;
	const [adminUserId, expStr, sigHex] = parts;
	const expiresAt = Number(expStr);
	if (!adminUserId || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

	const expected = hexToBytes(sigHex);
	if (!expected) return null;

	const key = await getKey();
	const computed = new Uint8Array(
		await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${adminUserId}.${expStr}`)),
	);

	if (!timingSafeEqual(computed, expected)) return null;
	return { adminUserId, expiresAt };
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
