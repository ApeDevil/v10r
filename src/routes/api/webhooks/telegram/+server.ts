import { timingSafeEqual } from 'node:crypto';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { linkTelegramAccount, sendTelegramMessage } from '$lib/server/notifications/telegram';
import type { RequestHandler } from './$types';

type TelegramUpdate = {
	message?: {
		text?: string;
		chat: { id: number | string };
		from?: { username?: string | null };
	};
};

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
	const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET;
	if (!webhookSecret) {
		return json({ ok: false }, { status: 503 });
	}
	const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
	if (!secretHeader || !safeEqual(secretHeader, webhookSecret)) {
		return json({ ok: false }, { status: 401 });
	}

	const rawBody = await request.text().catch(() => '');
	let body: TelegramUpdate | null = null;
	try {
		body = rawBody ? (JSON.parse(rawBody) as TelegramUpdate) : null;
	} catch {
		// Malformed JSON from a secret-token holder — ack so Telegram stops retrying.
		return json({ ok: true });
	}
	if (!body?.message?.text) {
		return json({ ok: true });
	}

	const chatId = String(body.message.chat.id);
	const text = body.message.text;
	const username = body.message.from?.username ?? null;

	// Only handle /start TOKEN command
	if (!text.startsWith('/start ')) {
		return json({ ok: true });
	}

	const token = text.slice(7).trim();
	if (!token) {
		await sendTelegramMessage(botToken, chatId, 'Invalid token. Please use the link from your notification settings.');
		return json({ ok: true });
	}

	const result = await linkTelegramAccount({ token, chatId, username });

	if (result.status === 'expired') {
		await sendTelegramMessage(
			botToken,
			chatId,
			'Token expired or invalid. Please generate a new link from notification settings.',
		);
		return json({ ok: true });
	}

	await sendTelegramMessage(botToken, chatId, 'Connected! You will now receive notifications here.');
	return json({ ok: true });
};
