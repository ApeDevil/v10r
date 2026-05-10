import { redis } from '$lib/server/cache';
import { AI_DAILY_TOKEN_CAP } from '$lib/server/config';
import type { PageServerLoad } from './$types';

function dayKey(userId: string): string {
	const day = new Date().toISOString().slice(0, 10);
	return `ai:budget:${userId}:${day}`;
}

function msUntilUtcMidnight(): number {
	const now = new Date();
	const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
	return tomorrow.getTime() - now.getTime();
}

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	let used = 0;
	if (user && redis) {
		used = (await redis.get<number>(dayKey(user.id))) ?? 0;
	}

	return {
		title: 'AI Budget - Anti-Abuse - Showcases',
		dailyCap: AI_DAILY_TOKEN_CAP,
		signedIn: !!user,
		usedToday: used,
		remaining: Math.max(0, AI_DAILY_TOKEN_CAP - used),
		percentUsed: Math.min(100, (used / AI_DAILY_TOKEN_CAP) * 100),
		resetsInMs: msUntilUtcMidnight(),
	};
};
