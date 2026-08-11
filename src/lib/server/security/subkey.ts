/**
 * Purpose-separated secret derivation.
 *
 * Several subsystems need a MAC key of their own — the analytics visitor hash,
 * the blog upload ticket. Each could take its own required environment
 * variable, but a *required* secret that ships empty is the worst of both
 * worlds: the feature is broken until an operator acts, and the failure mode is
 * whatever the caller wrote in its else-branch. `PAIRING_SECRET` already
 * demonstrates the cost — `pairing/cookie.ts:33` throws when it is unset, and
 * `.env.example` ships it empty, so pairing is off until someone notices.
 *
 * Instead, derive from a root that is guaranteed present. `BETTER_AUTH_SECRET`
 * is validated at module load in `auth/index.ts` (throws below 32 chars) and
 * `hooks.server.ts` imports `auth`, so no request is ever served without it.
 * Each purpose gets `HMAC-SHA256(root, purpose)` — a distinct label yields an
 * independent key, recovering one does not recover the root, and Better Auth
 * never MACs attacker-chosen data under these labels. Standard HKDF-extract
 * practice.
 *
 * Every purpose still accepts an explicit override variable, so a key CAN be
 * rotated independently without touching the auth secret. That is the point:
 * rotation stays available without being mandatory.
 */
import { createHmac } from 'node:crypto';
import { env } from '$env/dynamic/private';

export const SUBKEY_PURPOSES = {
	analyticsVisitor: 'v10r:analytics-visitor:v1',
	analyticsConfirm: 'v10r:analytics-confirm:v1',
	blogUploadTicket: 'v10r:blog-upload-ticket:v1',
} as const;

export type SubkeyPurpose = (typeof SUBKEY_PURPOSES)[keyof typeof SUBKEY_PURPOSES];

/** Optional per-purpose override, for rotating one key without the root. */
const OVERRIDE_VAR: Record<SubkeyPurpose, string> = {
	[SUBKEY_PURPOSES.analyticsVisitor]: 'ANALYTICS_VISITOR_SALT',
	[SUBKEY_PURPOSES.analyticsConfirm]: 'ANALYTICS_CONFIRM_SECRET',
	[SUBKEY_PURPOSES.blogUploadTicket]: 'BLOG_UPLOAD_TICKET_SECRET',
};

const cache = new Map<SubkeyPurpose, string>();

/**
 * Resolve the key for a purpose. Memoized — derivation is cheap, but this sits
 * on the analytics write path and there is no reason to pay for it per request.
 *
 * Throws when neither the override nor the root secret is available. That is
 * deliberate and cannot happen in a served request; a silent fallback here
 * would mean the shipped default is the unkeyed construction this exists to
 * replace.
 */
export function deriveSubkey(purpose: SubkeyPurpose): string {
	const cached = cache.get(purpose);
	if (cached) return cached;

	const override = env[OVERRIDE_VAR[purpose]];
	if (override) {
		cache.set(purpose, override);
		return override;
	}

	const root = env.BETTER_AUTH_SECRET;
	if (!root) {
		throw new Error(
			`deriveSubkey(${purpose}): neither ${OVERRIDE_VAR[purpose]} nor BETTER_AUTH_SECRET is set. ` +
				'BETTER_AUTH_SECRET is required for the app to boot, so reaching this is a configuration bug.',
		);
	}

	const derived = createHmac('sha256', root).update(purpose).digest('hex');
	cache.set(purpose, derived);
	return derived;
}

/** Drop the memo so a changed environment takes effect. Tests only. */
export function resetSubkeyCache(): void {
	cache.clear();
}
