import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { userDiscordAccounts } from '$lib/server/db/schema/notifications/discord';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt } from '../crypto';
import type { NotificationProvider, DeliveryPayload, DeliveryResult } from './types';

export class DiscordProvider implements NotificationProvider {
	getProviderName() {
		return 'discord';
	}

	async validateConnection(): Promise<boolean> {
		return !!env.DISCORD_BOT_TOKEN;
	}

	async send(payload: DeliveryPayload): Promise<DeliveryResult> {
		const botToken = env.DISCORD_BOT_TOKEN;
		if (!botToken) {
			return { success: false, errorCode: 'NO_BOT_TOKEN', errorMessage: 'DISCORD_BOT_TOKEN not configured', retryable: false };
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

/** Refresh Discord OAuth2 tokens for an account */
export async function refreshDiscordTokens(accountId: string): Promise<boolean> {
	const [account] = await db
		.select()
		.from(userDiscordAccounts)
		.where(eq(userDiscordAccounts.id, accountId))
		.limit(1);

	if (!account) return false;

	const clientId = env.DISCORD_CLIENT_ID;
	const clientSecret = env.DISCORD_CLIENT_SECRET;
	if (!clientId || !clientSecret) return false;

	try {
		const refreshToken = await decrypt(account.refreshToken);

		const res = await fetch('https://discord.com/api/v10/oauth2/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'refresh_token',
				refresh_token: refreshToken,
				client_id: clientId,
				client_secret: clientSecret,
			}),
		});

		if (!res.ok) {
			await db
				.update(userDiscordAccounts)
				.set({ tokenRefreshFailedAt: new Date() })
				.where(eq(userDiscordAccounts.id, accountId));
			return false;
		}

		const tokens = await res.json();
		const encAccessToken = await encrypt(tokens.access_token);
		const encRefreshToken = await encrypt(tokens.refresh_token);
		const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

		await db
			.update(userDiscordAccounts)
			.set({
				accessToken: encAccessToken,
				refreshToken: encRefreshToken,
				tokenExpiresAt: expiresAt,
				tokensRefreshedAt: new Date(),
				tokenRefreshFailedAt: null,
			})
			.where(eq(userDiscordAccounts.id, accountId));

		return true;
	} catch {
		await db
			.update(userDiscordAccounts)
			.set({ tokenRefreshFailedAt: new Date() })
			.where(eq(userDiscordAccounts.id, accountId));
		return false;
	}
}
