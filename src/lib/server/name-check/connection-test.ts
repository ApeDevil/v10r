/**
 * Connection test — one real search against a vendor with the credentials on the form.
 *
 * The probe is the source's own `search()`, not a separate "ping": what an administrator
 * wants to know is whether these credentials answer the request the check will make,
 * hosts and headers included. One attempt, its own budget, no cache, quota or breaker —
 * those belong to the public check — and a classified outcome plus timing, never the
 * vendor's response body.
 *
 * `invalid_credentials` is read off the HTTP status `fetch-json.ts` records in the error
 * message: EUIPO's token endpoint answers 400/401 to a wrong secret, its gateway 401/403
 * to an app without an approved subscription, Tavily and Brave 401/403 to a wrong key.
 * Anything else non-OK is `unavailable` — a wrong host is not a wrong password. The
 * message itself travels as `detail`, since the EUIPO source names the failing step in it.
 */
import type { NameSourceTestOutcome, NameSourceTestResult } from '$lib/name-check/connection';
import { DeadlineExceededError, startDeadline } from '$lib/server/http/deadline';
import type { NameSourceVendor } from '$lib/types/db-enums';
import { SOURCE_TEST_BUDGET_MS } from './config';
import { NameSourceError } from './errors';
import { type NameSource, type NameSourceCredentials, NO_CREDENTIALS } from './name-source';
import { toNameCheckQuery } from './query';
import { euipoSource, resetEuipoTokens } from './sources/euipo';
import { webSource } from './sources/web';

export type { NameSourceTestOutcome, NameSourceTestResult } from '$lib/name-check/connection';

/** A name that exists in every registry, so an empty answer cannot be mistaken for a working one. */
const PROBE_QUERY = toNameCheckQuery({ query: 'velociraptor', territory: 'eu', category: null });

const CREDENTIAL_STATUSES = /\bHTTP (400|401|403)$/;

function classifyFailure(err: unknown): NameSourceTestOutcome {
	if (err instanceof DeadlineExceededError) return 'timeout';
	if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) return 'timeout';
	if (err instanceof NameSourceError) {
		if (err.kind === 'rate_limited') return 'rate_limited';
		if (err.kind === 'credentials_missing') return 'invalid_credentials';
		if (CREDENTIAL_STATUSES.test(err.message)) return 'invalid_credentials';
		return 'unavailable';
	}
	return 'unknown';
}

/** What the result line shows beside the outcome: our own message, never a vendor body. */
function failureDetail(err: unknown): string {
	if (err instanceof DeadlineExceededError) return `no answer within ${SOURCE_TEST_BUDGET_MS} ms`;
	if (err instanceof NameSourceError) return err.message;
	return err instanceof Error ? err.name : 'unknown failure';
}

/**
 * The credentials exactly one vendor sees. The web source prefers Tavily whenever a
 * Tavily key is present, so a Brave test must hide it; EUIPO's token cache is keyed by
 * client id, so a draft secret must not inherit the token the saved one minted.
 */
export function credentialsForVendor(
	vendor: NameSourceVendor,
	credentials: NameSourceCredentials,
): NameSourceCredentials {
	switch (vendor) {
		case 'euipo':
			return { ...NO_CREDENTIALS, euipo: credentials.euipo };
		case 'tavily':
			return { ...NO_CREDENTIALS, tavilyApiKey: credentials.tavilyApiKey };
		case 'brave':
			return { ...NO_CREDENTIALS, braveApiKey: credentials.braveApiKey };
	}
}

export interface NameSourceTestOptions {
	fetch?: typeof fetch;
	now?: () => Date;
	/** Test seam. Defaults to the vendor's real source. */
	source?: NameSource;
}

export async function testNameSourceConnection(
	vendor: NameSourceVendor,
	credentials: NameSourceCredentials,
	options: NameSourceTestOptions = {},
): Promise<NameSourceTestResult> {
	const now = options.now ?? (() => new Date());
	const source = options.source ?? (vendor === 'euipo' ? euipoSource : webSource);
	const startedAt = performance.now();
	const testedAt = now().toISOString();
	if (vendor === 'euipo') resetEuipoTokens();

	try {
		const search = source.search;
		if (!search) throw new NameSourceError('unavailable', `${source.id} offers no automated search`);
		const deadline = startDeadline(SOURCE_TEST_BUDGET_MS);
		await deadline.run((signal) =>
			search(PROBE_QUERY, {
				deadline,
				signal,
				credentials: credentialsForVendor(vendor, credentials),
				fetch: options.fetch ?? fetch,
				now,
				resolveNs: async () => [],
			}),
		);
		return { outcome: 'ok', latencyMs: Math.round(performance.now() - startedAt), testedAt };
	} catch (err) {
		return {
			outcome: classifyFailure(err),
			latencyMs: Math.round(performance.now() - startedAt),
			testedAt,
			detail: failureDetail(err),
		};
	}
}
