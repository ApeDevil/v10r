import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const TAKEN_USERNAMES = ['admin', 'test', 'user', 'root', 'moderator', 'system'];

export const GET: RequestHandler = async ({ url }) => {
	const username = url.searchParams.get('u')?.toLowerCase() ?? '';

	// Simulate network delay
	await new Promise((r) => setTimeout(r, 300));

	const available = username.length >= 3 && !TAKEN_USERNAMES.includes(username);

	return json({ available });
};
