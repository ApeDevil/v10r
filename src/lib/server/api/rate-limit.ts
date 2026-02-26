import { json } from '@sveltejs/kit';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '$lib/server/cache';

export function createLimiter(prefix: string, max: number, window: string) {
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
