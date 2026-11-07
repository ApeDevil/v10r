import { CONSENT_COOKIE, CONSENT_MAX_AGE, SESSION_COOKIE } from '#lib/server/analytics/config.ts';
import { siteOperator } from '#lib/server/legal/index.ts';
import { retentionDays } from '#lib/server/retention/index.ts';
import type { PageServerLoad } from './$types';

/**
 * DATENSCHUTZERKLÄRUNG — the privacy policy of v10r.dev (GDPR Art. 13/14).
 *
 * The binding legal page, as distinct from `/showcases/privacy`, which is the
 * privacy *pattern* and renders template values. The controller comes from the
 * site-operator record shared with /impressum; every storage period comes from the
 * retention schedule the cleanup jobs enforce, so the policy cannot promise a window
 * the code does not keep.
 *
 * SSR, never prerendered, for the same reason as /impressum: the `X-Robots-Tag`
 * keeping the postal address out of search snippets needs a real response.
 */
export const prerender = false;

export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({ 'X-Robots-Tag': 'noindex, noarchive, nosnippet, noai, noimageai' });

	return {
		operator: siteOperator,
		cookies: {
			consent: CONSENT_COOKIE,
			consentDays: Math.round(CONSENT_MAX_AGE / 86_400),
			session: SESSION_COOKIE,
		},
		retention: {
			events: retentionDays('analytics-events'),
			userEvents: retentionDays('analytics-user-events'),
			consent: retentionDays('consent-events'),
			aiTurnBodies: retentionDays('ai-turn-bodies'),
			aiTurns: retentionDays('ai-turns'),
		},
	};
};
