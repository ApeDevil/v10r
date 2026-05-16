import { PER_EMAIL_LIMIT_MAX, PER_EMAIL_LIMIT_PREFIX, PER_EMAIL_LIMIT_WINDOW } from '$lib/server/abuse';
import {
	AI_RATE_LIMIT_MAX,
	AI_RATE_LIMIT_PREFIX,
	AI_RATE_LIMIT_WINDOW,
	AUTH_RATE_LIMIT_MAX,
	AUTH_RATE_LIMIT_WINDOW,
	FEEDBACK_RATE_LIMIT_MAX,
	FEEDBACK_RATE_LIMIT_PREFIX,
	FEEDBACK_RATE_LIMIT_WINDOW,
	USERNAME_CHECK_RATE_LIMIT_MAX,
	USERNAME_CHECK_RATE_LIMIT_WINDOW,
} from '$lib/server/config';
import type { PageServerLoad } from './$types';

interface LimiterRow {
	prefix: string;
	max: number;
	window: string;
	keyedOn: 'IP' | 'sha256(email)' | 'IP + path';
	surface: string;
	scope: string;
}

export const load: PageServerLoad = async () => {
	const rows: LimiterRow[] = [
		{
			prefix: 'rl:auth (Better Auth wrapper)',
			max: AUTH_RATE_LIMIT_MAX,
			window: AUTH_RATE_LIMIT_WINDOW,
			keyedOn: 'IP',
			surface: '/api/auth/sign-in/*',
			scope: 'Coarse per-IP gate on sign-in endpoints',
		},
		{
			prefix: PER_EMAIL_LIMIT_PREFIX,
			max: PER_EMAIL_LIMIT_MAX,
			window: PER_EMAIL_LIMIT_WINDOW,
			keyedOn: 'sha256(email)',
			surface: 'magic-link send + email-OTP send',
			scope: 'Email-bombing fix: caps sends per target inbox regardless of source IP',
		},
		{
			prefix: 'rl:captcha:challenge',
			max: 30,
			window: '60 s',
			keyedOn: 'IP',
			surface: '/api/captcha/challenge',
			scope: 'Prevents stockpiling of pre-solved ALTCHA challenges',
		},
		{
			prefix: AI_RATE_LIMIT_PREFIX,
			max: AI_RATE_LIMIT_MAX,
			window: AI_RATE_LIMIT_WINDOW,
			keyedOn: 'IP',
			surface: '/api/ai/chat',
			scope: 'Per-IP rate limit on chat completions (in addition to per-user daily token cap)',
		},
		{
			prefix: FEEDBACK_RATE_LIMIT_PREFIX,
			max: FEEDBACK_RATE_LIMIT_MAX,
			window: FEEDBACK_RATE_LIMIT_WINDOW,
			keyedOn: 'IP',
			surface: '/feedback (form action)',
			scope: 'Public feedback submission — paired with honeypot for unauthenticated posts',
		},
		{
			prefix: 'rl:username:check',
			max: USERNAME_CHECK_RATE_LIMIT_MAX,
			window: USERNAME_CHECK_RATE_LIMIT_WINDOW,
			keyedOn: 'IP',
			surface: '/api/showcases/check-username',
			scope: 'Username availability probe — prevents enumeration scraping',
		},
	];

	return {
		title: 'Rate Limits - Anti-Abuse - Showcases',
		rows,
	};
};
