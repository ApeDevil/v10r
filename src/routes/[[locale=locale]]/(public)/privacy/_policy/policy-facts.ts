/**
 * What every language version of the privacy policy renders from: the operator, the
 * cookie names and the enforced storage periods, all supplied by the page's server
 * load so no translation can state a different value.
 */
export interface PolicyFacts {
	/** The site-operator record's public fields — structural, because client code cannot import `#lib/server`. */
	operator: { name: string; street: string; postalCode: string; city: string; country: string; email: string };
	cookieNames: { consent: string; consentDays: number; session: string };
	retention: { events: number; userEvents: number; consent: number; aiTurnBodies: number; aiTurns: number };
}

/**
 * The day the policy text was last checked against the code — one date for all
 * language versions. Bump it with every content change, in every version.
 */
export const POLICY_REVIEWED_ON = '2026-11-07';

/** `POLICY_REVIEWED_ON` written out for one locale ("7. November 2026", "November 7, 2026", …). */
export function reviewedOn(locale: string): string {
	return new Date(`${POLICY_REVIEWED_ON}T12:00:00Z`).toLocaleDateString(locale, { dateStyle: 'long', timeZone: 'UTC' });
}
