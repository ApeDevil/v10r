import { timingSafeEqual } from 'node:crypto';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { eq, and, gt, sql } from 'drizzle-orm';
import { telegramVerificationTokens, userTelegramAccounts } from '$lib/server/db/schema/notifications/telegram';
import type { RequestHandler } from './$types';

function safeEqual(a: string, b: string): boolean {
	const bufA = Buffer.from(a);
	const bufB = Buffer.from(b);
	if (bufA.length !== bufB.length) return false;
	return timingSafeEqual(bufA, bufB);
}

export const POST: RequestHandler = async ({ request }) => {
	const botToken = env.TELEGRAM_BOT_TOKEN;
	if (!botToken) {
		return json({ ok: false }, { status: 503 });
	}

	// Verify request originates from Telegram via secret token
	// Set via: POST https://api.telegram.org/bot{token}/setWebhook with secret_token param
	const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET;
	if (!webhookSecret) {
		return json({ ok: false }, { status: 503 });
	}
	const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
	if (!secretHeader || !safeEqual(secretHeader, webhookSecret)) {
		return json({ ok: false }, { status: 403 });
	}

	const body = await request.json().catch(() => null);
	if (!body?.message?.text) {
		return json({ ok: true });
	}

	const { message } = body;
	const chatId = String(message.chat.id);
	const text: string = message.text;
	const username = message.from?.username ?? null;

	// Handle /start TOKEN command
	if (!text.startsWith('/start ')) {
		return json({ ok: true });
	}

	const token = text.slice(7).trim();
	if (!token) {
		await sendTelegramMessage(botToken, chatId, 'Invalid token. Please use the link from your notification settings.');
		return json({ ok: true });
	}

	// Validate token
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
		await sendTelegramMessage(botToken, chatId, 'Token expired or invalid. Please generate a new link from notification settings.');
		return json({ ok: true });
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

	await sendTelegramMessage(botToken, chatId, 'Connected! You will now receive notifications here.');

	return json({ ok: true });
};

async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
	await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ chat_id: chatId, text }),
	}).catch(() => {});
}
