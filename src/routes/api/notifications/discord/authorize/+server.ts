import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { guardApiUser } from '$lib/server/http/guards';
import { apiError } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, cookies }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;

	const clientId = env.DISCORD_CLIENT_ID;
	const redirectUri = env.DISCORD_REDIRECT_URI;

	if (!clientId || !redirectUri) {
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

	redirect(302, `https://discord.com/api/oauth2/authorize?${params}`);
};
