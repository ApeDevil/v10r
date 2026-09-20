import { env } from '$env/dynamic/private';
import type { DeliveryChannel, DeliveryPayload, DeliveryResult } from './types';

export class DiscordChannel implements DeliveryChannel {
	async send(payload: DeliveryPayload): Promise<DeliveryResult> {
		const botToken = env.DISCORD_BOT_TOKEN;
		if (!botToken) {
			return {
				success: false,
				errorCode: 'NO_BOT_TOKEN',
				errorMessage: 'DISCORD_BOT_TOKEN not configured',
				retryable: false,
			};
		}

		const discordUserId = payload.to;

		try {
			// Step 1: Create/get DM channel
			const channelRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
				method: 'POST',
				headers: {
					Authorization: `Bot ${botToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ recipient_id: discordUserId }),
			});

			if (!channelRes.ok) {
				const errData = await channelRes.json().catch(() => ({}));

				// 403 or error code 50007 = cannot DM user
				if (channelRes.status === 403 || errData.code === 50007) {
					return { success: false, errorCode: '403', errorMessage: 'Cannot send DM to user', retryable: false };
				}

				return {
					success: false,
					errorCode: String(channelRes.status),
					errorMessage: errData.message ?? 'Failed to create DM channel',
					retryable: channelRes.status >= 500 || channelRes.status === 429,
				};
			}

			const channel = await channelRes.json();

			// Step 2: Send message
			const msgRes = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
				method: 'POST',
				headers: {
					Authorization: `Bot ${botToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					embeds: [
						{
							title: payload.subject,
							description: payload.body,
							color: 0x5865f2, // Discord blurple
							timestamp: new Date().toISOString(),
						},
					],
				}),
			});

			if (msgRes.ok) {
				const msg = await msgRes.json();
				return { success: true, providerMessageId: msg.id };
			}

			const msgErr = await msgRes.json().catch(() => ({}));

			if (msgRes.status === 403 || msgErr.code === 50007) {
				return { success: false, errorCode: '403', errorMessage: 'Cannot send DM to user', retryable: false };
			}

			return {
				success: false,
				errorCode: String(msgRes.status),
				errorMessage: msgErr.message ?? 'Failed to send message',
				retryable: msgRes.status >= 500 || msgRes.status === 429,
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
