import { env } from '$env/dynamic/private';
import type { NotificationProvider, DeliveryPayload, DeliveryResult } from './types';

function buildHtml(subject: string, body: string): string {
	return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a1a; margin-bottom: 16px;">${subject}</h2>
  <p style="color: #333; line-height: 1.6;">${body}</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
  <p style="color: #999; font-size: 12px;">This is an automated notification. You can manage your preferences in notification settings.</p>
</body>
</html>`;
}

export class EmailProvider implements NotificationProvider {
	getProviderName() {
		return 'resend';
	}

	async validateConnection(): Promise<boolean> {
		return !!env.RESEND_API_KEY;
	}

	async send(payload: DeliveryPayload): Promise<DeliveryResult> {
		const apiKey = env.RESEND_API_KEY;
		const fromEmail = env.RESEND_FROM_EMAIL ?? 'notifications@example.com';

		if (!apiKey) {
			return { success: false, errorCode: 'NO_API_KEY', errorMessage: 'RESEND_API_KEY not configured', retryable: false };
		}

		try {
			const res = await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					from: fromEmail,
					to: [payload.to],
					subject: payload.subject,
					html: payload.htmlBody ?? buildHtml(payload.subject, payload.body),
				}),
			});

			if (res.ok) {
				const data = await res.json();
				return { success: true, providerMessageId: data.id };
			}

			const error = await res.json().catch(() => ({ message: res.statusText }));
			const retryable = res.status >= 500 || res.status === 429;

			return {
				success: false,
				errorCode: String(res.status),
				errorMessage: error.message ?? 'Unknown error',
				retryable,
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
