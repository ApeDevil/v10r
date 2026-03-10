import { env } from '$env/dynamic/private';
import type { DeliveryPayload, DeliveryResult, NotificationProvider } from './types';

export class TelegramProvider implements NotificationProvider {
	getProviderName() {
		return 'telegram';
	}

	async validateConnection(): Promise<boolean> {
		return !!env.TELEGRAM_BOT_TOKEN;
	}

	async send(payload: DeliveryPayload): Promise<DeliveryResult> {
		const botToken = env.TELEGRAM_BOT_TOKEN;
		if (!botToken) {
			return {
				success: false,
				errorCode: 'NO_BOT_TOKEN',
				errorMessage: 'TELEGRAM_BOT_TOKEN not configured',
				retryable: false,
			};
		}

		// payload.to is the Telegram chat ID
		const chatId = payload.to;

		try {
			const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					chat_id: chatId,
					text: `<b>${escapeHtml(payload.subject)}</b>\n\n${escapeHtml(payload.body)}`,
					parse_mode: 'HTML',
					disable_web_page_preview: true,
				}),
			});

			const data = await res.json();

			if (data.ok) {
				return { success: true, providerMessageId: String(data.result.message_id) };
			}

			// 403 = bot blocked by user
			if (data.error_code === 403) {
				return { success: false, errorCode: '403', errorMessage: 'Bot blocked by user', retryable: false };
			}

			// 429 = rate limited
			if (data.error_code === 429) {
				return { success: false, errorCode: '429', errorMessage: 'Rate limited', retryable: true };
			}

			return {
				success: false,
				errorCode: String(data.error_code),
				errorMessage: data.description ?? 'Unknown Telegram error',
				retryable: (data.error_code ?? 0) >= 500,
			};
		} catch (err) {
			return {
				success: false,
				errorCode: 'NETWORK',
				errorMessage: err instanceof Error ? err.message : 'Network error',
				retryable: true,
			};
		}
	}
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
