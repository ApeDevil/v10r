/**
 * SESSION REVOCATION EPOCH — makes "kill their sessions" take effect now.
 *
 * `session.cookieCache` (enabled, 300s) means `getSession()` answers from a
 * signed cookie payload without touching Postgres. That is the right call for
 * throughput, but it has a sharp edge: deleting session ROWS — which is what
 * `factor-changes.ts` does on `revokeSiblings`, and what banning does — is
 * invisible for up to five minutes. The one operation whose entire purpose is
 * "revoke access immediately" was the one the cache silently deferred.
 *
 * So revocation gets its own out-of-band signal, on the same principle as
 * step-up freshness (see `./step-up.ts`): security state that must not ride the
 * cookie cache lives in Redis and is read directly.
 *
 * `authepoch:<userId>` stores `<epochMs>|<sha256(keepToken)>`. Any session
 * created before the epoch is revoked — EXCEPT the one whose token hashes to
 * the keep-hash. That exception is load-bearing: `revokeSiblings` deliberately
 * spares the acting device, so a plain "everything older than now is dead"
 * epoch would log out the very person who just secured their account.
 *
 * TTL is SESSION_EXPIRES_IN, so keys expire once no session could predate them.
 *
 * Must never import the Better Auth instance — `auth/index.ts` imports this
 * module via its hooks (same cycle constraint as step-up.ts).
 */
import { createHash } from 'node:crypto';
import { dev } from '$app/environment';
import { redis } from '$lib/server/cache';
import { SESSION_EXPIRES_IN } from '$lib/server/config';

const key = (userId: string) => `authepoch:${userId}`;

/** Token hashes are stored, never raw tokens — this value sits in Redis. */
function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/**
 * Mark every session for this user, other than `keepToken`, as revoked from now.
 *
 * ALWAYS call this alongside the row delete, never instead of it: the rows are
 * the source of truth, this is only what closes the cookie-cache window.
 */
export async function stampRevocation(userId: string, keepToken?: string | null): Promise<void> {
	if (!redis) {
		if (dev) console.warn('[revocation] Redis unavailable — revocation epoch not recorded');
		return;
	}
	const value = `${Date.now()}|${keepToken ? hashToken(keepToken) : ''}`;
	await redis.set(key(userId), value, { ex: SESSION_EXPIRES_IN });
}

/** Clear the epoch — used on unban, so the user can sign in cleanly again. */
export async function clearRevocation(userId: string): Promise<void> {
	if (!redis) return;
	await redis.del(key(userId));
}

/**
 * True when this session predates the user's revocation epoch and is not the
 * spared token.
 *
 * Redis unavailable ⇒ returns false (not revoked). This is deliberate and is
 * the opposite of step-up's posture: failing closed here would sign out every
 * user on the platform during an Upstash blip, which is a far worse outcome
 * than briefly honouring a session that a rarely-used admin action revoked.
 * The DB row delete still stands; only the cache window widens.
 */
export async function isSessionRevoked(
	userId: string,
	sessionCreatedAt: Date | string | number | null | undefined,
	sessionToken: string | null | undefined,
): Promise<boolean> {
	if (!redis) return false;

	let raw: string | null;
	try {
		raw = await redis.get<string>(key(userId));
	} catch (err) {
		console.error('[revocation] epoch read failed:', err instanceof Error ? err.message : err);
		return false;
	}
	if (!raw) return false;

	const [epochStr, keepHash = ''] = String(raw).split('|');
	const epoch = Number(epochStr);
	if (!Number.isFinite(epoch)) return false;

	if (sessionToken && keepHash && hashToken(sessionToken) === keepHash) return false;

	const createdAt = sessionCreatedAt ? new Date(sessionCreatedAt).getTime() : Number.NaN;
	// Unknown creation time is treated as revoked: the epoch only exists because
	// someone asked for these sessions to die, so ambiguity resolves to denial.
	if (!Number.isFinite(createdAt)) return true;

	return createdAt < epoch;
}
