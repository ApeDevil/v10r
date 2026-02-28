import { json } from '@sveltejs/kit';
import { Ratelimit, type Duration } from '@upstash/ratelimit';
import { redis } from '$lib/server/cache';

interface Limiter {
	limit(id: string): Promise<{ success: boolean; reset: number }>;
}

const passthrough: Limiter = {
	async limit() {
		return { success: true, reset: 0 };
	},
};

export function createLimiter(prefix: string, max: number, window: Duration): Limiter {
	if (!redis) {
		console.warn(`[rate-limit] Redis unavailable — rate limiting DISABLED for ${prefix}`);
		return passthrough;
	}
	return new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(max, window),
		prefix,
	});
}

export function rateLimitResponse(reset: number, message = 'Too many requests. Please wait a moment.'): Response {
	return json(
		{ error: message },
		{
			status: 429,
			headers: { 'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)) },
		},
	);
}
