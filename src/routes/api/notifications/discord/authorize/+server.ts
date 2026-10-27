import { redirect } from '@sveltejs/kit';
import { siteUrl } from '#lib/server/auth/index.ts';
import { guardApiUser } from '#lib/server/http/guards.ts';
import { apiError } from '#lib/server/http/response.ts';
import { DISCORD_OAUTH_CALLBACK_PATH } from '#lib/server/notifications/config.ts';
import { DISCORD_CLIENT_ID } from '$app/env/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, cookies }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;

	const clientId = DISCORD_CLIENT_ID;
	const redirectUri = new URL(DISCORD_OAUTH_CALLBACK_PATH, siteUrl).href;

	if (!clientId) {
		return apiError(503, 'unavailable', 'Discord not configured');
	}

	// Generate CSRF state token
	const state = crypto.randomUUID();
	cookies.set('discord_oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: true,
		maxAge: 600, // 10 minutes
	});

	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'identify',
		state,
		prompt: 'consent',
	});

	// SvelteKit 3 refuses cross-origin redirects unless their origin is allowed by name.
	redirect(302, `https://discord.com/api/oauth2/authorize?${params}`, { external: ['https://discord.com'] });
};
