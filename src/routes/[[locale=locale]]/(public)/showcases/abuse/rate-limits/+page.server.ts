import { PER_EMAIL_LIMIT_MAX, PER_EMAIL_LIMIT_PREFIX, PER_EMAIL_LIMIT_WINDOW } from '$lib/server/abuse';
// Namespaced, because this page is the one place that shows four domains' limits side by
// side — `aiPolicy.RATE_LIMIT_MAX` vs `authPolicy.RATE_LIMIT_MAX` is the distinction the
// table is about.
import * as aiPolicy from '$lib/server/ai/config';
import * as authPolicy from '$lib/server/auth/config';
import * as feedbackPolicy from '$lib/server/feedback/config';
import { USERNAME_CHECK_RATE_LIMIT_MAX, USERNAME_CHECK_RATE_LIMIT_WINDOW } from '$lib/server/showcases/config';
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
			max: authPolicy.RATE_LIMIT_MAX,
			window: authPolicy.RATE_LIMIT_WINDOW,
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
			prefix: aiPolicy.RATE_LIMIT_PREFIX,
			max: aiPolicy.RATE_LIMIT_MAX,
			window: aiPolicy.RATE_LIMIT_WINDOW,
			keyedOn: 'IP',
			surface: '/api/ai/{chatbot,deskbot}',
			scope: 'Per-user rate limit on chat completions (in addition to per-user daily token cap)',
		},
		{
			prefix: feedbackPolicy.RATE_LIMIT_PREFIX,
			max: feedbackPolicy.RATE_LIMIT_MAX,
			window: feedbackPolicy.RATE_LIMIT_WINDOW,
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
