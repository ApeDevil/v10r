/**
 * Telegram account linking — verifies start tokens and upserts user↔chat associations.
 * Used by the webhook route handler and potentially AI tools or background jobs.
 */

import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { telegramVerificationTokens, userTelegramAccounts } from '$lib/server/db/schema/notifications/telegram';

export type LinkResult = { status: 'invalid_token' } | { status: 'expired' } | { status: 'linked'; userId: string };

/**
 * Validate a verification token and link a Telegram chat to the owning user.
 * Returns a discriminated result so the caller can choose the appropriate response.
 */
export async function linkTelegramAccount(opts: {
	token: string;
	chatId: string;
	username: string | null;
}): Promise<LinkResult> {
	const { token, chatId, username } = opts;

	// Validate token: must exist, not expired, not already used
	const [verification] = await db
		.select()
		.from(telegramVerificationTokens)
		.where(
			and(
				eq(telegramVerificationTokens.token, token),
				gt(telegramVerificationTokens.expiresAt, new Date()),
				sql`${telegramVerificationTokens.usedAt} IS NULL`,
			),
		)
		.limit(1);

	if (!verification) {
		return { status: 'expired' };
	}

	// Mark token as used
	await db
		.update(telegramVerificationTokens)
		.set({ usedAt: new Date() })
		.where(eq(telegramVerificationTokens.id, verification.id));

	// Upsert telegram account
	await db
		.insert(userTelegramAccounts)
		.values({
			id: crypto.randomUUID(),
			userId: verification.userId,
			telegramChatId: chatId,
			telegramUsername: username,
		})
		.onConflictDoUpdate({
			target: userTelegramAccounts.userId,
			set: {
				telegramChatId: chatId,
				telegramUsername: username,
				isActive: true,
				linkedAt: new Date(),
				unlinkedAt: null,
			},
		});

	return { status: 'linked', userId: verification.userId };
}

/**
 * Send a plain-text message to a Telegram chat via the Bot API.
 * Logs errors instead of swallowing them.
 */
export async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<void> {
	await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ chat_id: chatId, text }),
	}).catch((err) => console.error('[telegram] Failed to send message:', err));
}
