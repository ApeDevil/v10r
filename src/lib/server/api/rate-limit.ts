import { json } from '@sveltejs/kit';
import { type Duration, Ratelimit } from '@upstash/ratelimit';
import { dev } from '$app/environment';
import { redis } from '$lib/server/cache';

export interface Limiter {
	limit(id: string): Promise<{ success: boolean; reset: number }>;
	/** Read the remaining quota WITHOUT consuming a slot. */
	peek(id: string): Promise<{ remaining: number; reset: number }>;
}

const passthrough: Limiter = {
	async limit() {
		return { success: true, reset: 0 };
	},
	async peek() {
		return { remaining: Number.POSITIVE_INFINITY, reset: 0 };
	},
};

const failClosed: Limiter = {
	async limit() {
		return { success: false, reset: Date.now() + 60_000 };
	},
	async peek() {
		return { remaining: 0, reset: Date.now() + 60_000 };
	},
};

/**
 * What a limiter does when Upstash is SLOW (not down).
 *
 * The SDK's own `timeout` allows the request on expiry, so a latency spike
 * silently disables every limiter at once — and latency, not refusal, is the
 * realistic failure under load. But blanket fail-closed is worse than the bug
 * it fixes: it converts an Upstash blip into a total sign-in outage.
 *
 * So it is opt-in, and reserved for the buckets where the keyspace is small
 * enough that unlimited attempts actually break something — a 6-digit TOTP, or
 * someone else's inbox. Broad per-IP buckets stay open and just log loudly.
 */
export type TimeoutPolicy = 'open' | 'closed';

/** Deadline the policy is applied at. */
const TIMEOUT_DECISION_MS = 1000;
/** Outer net, above the decision deadline, so a hung call still unwinds. */
const TIMEOUT_NET_MS = 2000;

export function createLimiter(
	prefix: string,
	max: number,
	window: Duration,
	onTimeout: TimeoutPolicy = 'open',
): Limiter {
	if (!redis) {
		if (dev) {
			console.warn(`[rate-limit] Redis unavailable — rate limiting DISABLED for ${prefix}`);
			return passthrough;
		}
		console.error(`[rate-limit] Redis unavailable — BLOCKING all requests for ${prefix}`);
		return failClosed;
	}
	const ratelimit = new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(max, window),
		prefix,
		// Outer net only. The SDK allows the request when ITS timeout fires, which
		// is indistinguishable from a genuine allow at the call site — so the
		// decision-relevant deadline is the race below, and this sits above it
		// purely so a hung promise cannot eat the whole function budget.
		timeout: TIMEOUT_NET_MS,
	});
	// Wrap so a HARD Redis failure at runtime (e.g. ECONNREFUSED) fails CLOSED with a
	// proper 429 instead of throwing and 500-ing — matching the boot-time fail-closed
	// intent above.
	return {
		async limit(id: string) {
			try {
				// Race explicitly rather than trusting the SDK's timeout: we need to
				// KNOW a timeout happened to apply the policy, and the SDK reports it
				// as a successful allow.
				const timedOut = Symbol('timeout');
				const raced = await Promise.race([
					ratelimit.limit(id),
					new Promise<typeof timedOut>((resolve) => setTimeout(() => resolve(timedOut), TIMEOUT_DECISION_MS)),
				]);

				if (raced === timedOut) {
					console.error(
						`[rate-limit] Upstash slow for ${prefix} — reason=timeout policy=${onTimeout}. ` +
							`Limiting is ${onTimeout === 'closed' ? 'DENYING' : 'NOT enforced'} for this request.`,
					);
					return onTimeout === 'closed' ? { success: false, reset: Date.now() + 60_000 } : { success: true, reset: 0 };
				}

				return { success: raced.success, reset: raced.reset };
			} catch (err) {
				console.error(
					`[rate-limit] runtime Redis failure for ${prefix} — failing closed:`,
					err instanceof Error ? err.message : err,
				);
				return { success: false, reset: Date.now() + 60_000 };
			}
		},
		async peek(id: string) {
			try {
				// getRemaining has no SDK-level timeout (unlike limit) — bound it the
				// same way, and honour the same policy. peek() is the read half of the
				// per-email limiter, so leaving it fail-open would quietly undo that
				// bucket's 'closed' opt-in.
				const result = await Promise.race([
					ratelimit.getRemaining(id),
					new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_DECISION_MS)),
				]);
				if (result === null) {
					console.error(`[rate-limit] Upstash slow for ${prefix} (peek) — reason=timeout policy=${onTimeout}.`);
					return onTimeout === 'closed' ? { remaining: 0, reset: Date.now() + 60_000 } : { remaining: max, reset: 0 };
				}
				return { remaining: result.remaining, reset: result.reset };
			} catch (err) {
				console.error(
					`[rate-limit] runtime Redis failure for ${prefix} — failing closed:`,
					err instanceof Error ? err.message : err,
				);
				return { remaining: 0, reset: Date.now() + 60_000 };
			}
		},
	};
}

/**
 * True when the request is a top-level browser navigation — i.e. the response
 * will be rendered as the page. Sec-Fetch-Dest is authoritative on all modern
 * browsers; fall back to Accept sniffing for clients that omit it.
 */
export function isDocumentRequest(headers: Headers): boolean {
	const dest = headers.get('sec-fetch-dest');
	if (dest) return dest === 'document';
	return headers.get('accept')?.includes('text/html') ?? false;
}

export function rateLimitResponse(reset: number, message = 'Too many requests. Please wait a moment.'): Response {
	return json(
		{ error: { code: 'rate_limited', message } },
		{
			status: 429,
			headers: { 'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)) },
		},
	);
}
