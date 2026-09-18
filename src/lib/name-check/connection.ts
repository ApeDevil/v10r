/**
 * The admin page's wire contract for a source-connection test — what `/admin/name-check`
 * renders after the Test button, shared by the domain that produces it and the page that
 * shows it. Client-safe: no `$lib/server/` import, like `report.ts`.
 */
export const NAME_SOURCE_TEST_OUTCOMES = [
	'ok',
	'invalid_credentials',
	'rate_limited',
	'timeout',
	'unavailable',
	'unknown',
] as const;
export type NameSourceTestOutcome = (typeof NAME_SOURCE_TEST_OUTCOMES)[number];

export interface NameSourceTestResult {
	outcome: NameSourceTestOutcome;
	latencyMs: number;
	testedAt: string;
	/**
	 * The failing step and status as the source named it — "token endpoint: HTTP 401",
	 * "network failure (TypeError)" — so an operator can tell a wrong secret from a pending
	 * subscription. Built from our own messages only, never a vendor's response body.
	 * Absent on success.
	 */
	detail?: string;
}
