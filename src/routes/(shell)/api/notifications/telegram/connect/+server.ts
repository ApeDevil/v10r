import { env } from '$env/dynamic/private';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiOk } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { db } from '$lib/server/db';
import { telegramVerificationTokens } from '$lib/server/db/schema/notifications/telegram';
import type { RequestHandler } from './$types';

const limiter = createLimiter('rl:notifications:telegram', 10, '1 m');

export const POST: RequestHandler = async ({ locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const botUsername = env.TELEGRAM_BOT_USERNAME;
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
