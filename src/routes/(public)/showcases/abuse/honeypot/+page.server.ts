import { HONEYPOT_FIELD_NAME, HONEYPOT_MIN_FILL_MS } from '$lib/server/abuse';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		title: 'Honeypot - Anti-Abuse - Showcases',
		field: HONEYPOT_FIELD_NAME,
		minFillMs: HONEYPOT_MIN_FILL_MS,
		surfaces: [
			{
				label: 'Public feedback form',
				href: '/feedback',
				path: 'src/routes/(public)/feedback/+page.server.ts',
			},
		],
	};
};
