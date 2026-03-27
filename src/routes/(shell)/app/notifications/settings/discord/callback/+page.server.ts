import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { userDiscordAccounts } from '$lib/server/db/schema/notifications/discord';
import { encrypt } from '$lib/server/notifications/crypto';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals, cookies }) => {
	if (!locals.user) redirect(303, '/auth/login');

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const errorParam = url.searchParams.get('error');

	if (errorParam) {
		redirect(303, '/app/notifications/settings?error=discord_denied');
	}

	if (!code || !state) {
		error(400, 'Missing OAuth parameters');
	}

	// Validate CSRF state
	const savedState = cookies.get('discord_oauth_state');
	cookies.delete('discord_oauth_state', { path: '/' });

	if (!savedState || savedState !== state) {
		error(403, 'Invalid OAuth state');
	}

	const clientId = env.DISCORD_CLIENT_ID;
	const clientSecret = env.DISCORD_CLIENT_SECRET;
	const redirectUri = env.DISCORD_REDIRECT_URI;

	if (!clientId || !clientSecret || !redirectUri) {
		error(503, 'Discord not configured');
	}

	// Exchange code for tokens
	const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: redirectUri,
			client_id: clientId,
			client_secret: clientSecret,
		}),
	});

	if (!tokenRes.ok) {
		error(502, 'Failed to exchange Discord authorization code');
	}

	const tokens = await tokenRes.json();

	// Fetch Discord user info
	const userRes = await fetch('https://discord.com/api/v10/users/@me', {
		headers: { Authorization: `Bearer ${tokens.access_token}` },
	});

	if (!userRes.ok) {
		error(502, 'Failed to fetch Discord user info');
	}

	const discordUser = await userRes.json();

	// Encrypt tokens
	const encAccessToken = await encrypt(tokens.access_token);
	const encRefreshToken = await encrypt(tokens.refresh_token);
	const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

	// Upsert Discord account
	await db
		.insert(userDiscordAccounts)
		.values({
			id: crypto.randomUUID(),
			userId: locals.user.id,
			discordUserId: discordUser.id,
			discordUsername: discordUser.username,
			accessToken: encAccessToken,
			refreshToken: encRefreshToken,
			tokenExpiresAt,
		})
		.onConflictDoUpdate({
			target: userDiscordAccounts.userId,
			set: {
				discordUserId: discordUser.id,
				discordUsername: discordUser.username,
				accessToken: encAccessToken,
				refreshToken: encRefreshToken,
				tokenExpiresAt,
				isActive: true,
				linkedAt: new Date(),
				tokensRefreshedAt: new Date(),
				tokenRefreshFailedAt: null,
				unlinkedAt: null,
			},
		});

	redirect(303, '/app/notifications/settings?success=discord_connected');
};
