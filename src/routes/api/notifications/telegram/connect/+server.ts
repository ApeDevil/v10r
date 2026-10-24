import { db } from '#lib/server/db/index.ts';
import { telegramVerificationTokens } from '#lib/server/db/schema/notifications/telegram.ts';
import { guardApiUser } from '#lib/server/http/guards.ts';
import { createLimiter, rateLimitResponse } from '#lib/server/http/rate-limit.ts';
import { apiError, apiOk } from '#lib/server/http/response.ts';
import { TELEGRAM_BOT_USERNAME } from '$app/env/private';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:notifications:telegram', 10, '1 m');

export const POST: RequestHandler = async ({ locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const botUsername = TELEGRAM_BOT_USERNAME;
	if (!botUsername) {
		return apiError(503, 'unavailable', 'Telegram not configured');
	}

	// Generate verification token (32-byte Base64URL)
	const tokenBytes = new Uint8Array(32);
	crypto.getRandomValues(tokenBytes);
	const token = btoa(String.fromCharCode(...tokenBytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '');

	// 15 minute expiry
	const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

	await db.insert(telegramVerificationTokens).values({
		id: crypto.randomUUID(),
		userId: user.id,
		token,
		expiresAt,
	});

	const deepLink = `https://t.me/${botUsername}?start=${token}`;

	return apiOk({ deepLink, expiresAt: expiresAt.toISOString() });
};
