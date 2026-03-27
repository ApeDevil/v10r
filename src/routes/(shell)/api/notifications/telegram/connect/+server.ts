import { json } from '@sveltejs/kit';
import { and, count, eq, gt } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { requireApiUser } from '$lib/server/auth/guards';
import { db } from '$lib/server/db';
import { telegramVerificationTokens } from '$lib/server/db/schema/notifications/telegram';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	const { user } = requireApiUser(locals);

	const botUsername = env.TELEGRAM_BOT_USERNAME;
	if (!botUsername) {
		return json({ error: 'Telegram not configured' }, { status: 503 });
	}

	// Rate limit: max 3 tokens per hour per user
	const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
	const [{ count: recentCount }] = await db
		.select({ count: count() })
		.from(telegramVerificationTokens)
		.where(and(eq(telegramVerificationTokens.userId, user.id), gt(telegramVerificationTokens.createdAt, oneHourAgo)));

	if (recentCount >= 3) {
		return json({ error: 'Too many connection attempts. Try again later.' }, { status: 429 });
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

	return json({ deepLink, expiresAt: expiresAt.toISOString() });
};
