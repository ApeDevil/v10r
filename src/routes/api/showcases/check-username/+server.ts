import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const TAKEN_USERNAMES = ['admin', 'test', 'user', 'root', 'moderator', 'system'];

// Simple in-memory rate limiting for showcase endpoint
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
	const now = Date.now();
	const entry = requestCounts.get(ip);

	if (!entry || now > entry.resetAt) {
		requestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
		return true;
	}

	if (entry.count >= RATE_LIMIT_MAX) return false;

	entry.count++;
	return true;
}

export const GET: RequestHandler = async ({ url, getClientAddress }) => {
	const ip = getClientAddress();
	if (!checkRateLimit(ip)) {
		return json({ error: 'Too many requests' }, { status: 429 });
	}

	const username = url.searchParams.get('u')?.toLowerCase() ?? '';

	// Simulate network delay
	await new Promise((r) => setTimeout(r, 300));

	const available = username.length >= 3 && !TAKEN_USERNAMES.includes(username);

	return json({ available });
};
