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

export function createLimiter(prefix: string, max: number, window: Duration): Limiter {
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
		// Bound the Redis round-trip so a slow Upstash never eats the Vercel function
		// budget. On timeout the SDK allows the request (bounded fail-open).
		timeout: 1000,
	});
	// Wrap so a HARD Redis failure at runtime (e.g. ECONNREFUSED) fails CLOSED with a
	// proper 429 instead of throwing and 500-ing — matching the boot-time fail-closed
	// intent above. (A transient slowness still fails open via the SDK timeout.)
	return {
		async limit(id: string) {
			try {
				const { success, reset } = await ratelimit.limit(id);
				return { success, reset };
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
				// same way: transient slowness fails open, hard failure fails closed.
				const result = await Promise.race([
					ratelimit.getRemaining(id),
					new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000)),
				]);
				if (result === null) return { remaining: max, reset: 0 };
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
