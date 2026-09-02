import {
	ALTCHA_HMAC_KEY,
	BOT_DETECTION_MODE,
	HONEYPOT_FIELD_NAME,
	HONEYPOT_MIN_FILL_MS,
	PER_EMAIL_LIMIT_MAX,
	PER_EMAIL_LIMIT_WINDOW,
} from '$lib/server/abuse';
import { DAILY_TOKEN_CAP } from '$lib/server/ai/config';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		title: 'Anti-Abuse - Showcases',
		mode: BOT_DETECTION_MODE,
		captcha: {
			configured: ALTCHA_HMAC_KEY.length >= 32,
		},
		honeypot: {
			field: HONEYPOT_FIELD_NAME,
			minFillMs: HONEYPOT_MIN_FILL_MS,
		},
		perEmail: {
			max: PER_EMAIL_LIMIT_MAX,
			window: PER_EMAIL_LIMIT_WINDOW,
		},
		aiBudget: {
			dailyCap: DAILY_TOKEN_CAP,
		},
	};
};
