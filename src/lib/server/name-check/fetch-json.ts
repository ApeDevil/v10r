/**
 * The one outbound HTTP call the sources make.
 *
 * Small on purpose: an `accept` header, an identifying `user-agent`, a bounded JSON parse,
 * and a status mapped to exactly one `NameSourceError` kind — 429 honours `Retry-After` so
 * the breaker can be tripped rather than inferred. Nothing here logs a URL or a body: both
 * carry the name the user typed, and the privacy rule is that it never reaches a log line.
 */
import { SOURCE_USER_AGENT } from './config';
import { NameSourceError } from './errors';

export interface JsonRequest {
	url: string;
	method?: 'GET' | 'POST';
	headers?: Record<string, string>;
	body?: string;
	signal: AbortSignal;
	fetch: typeof fetch;
	/** Statuses handed back to the caller (body null) instead of thrown — RDAP's 404 is an answer. */
	pass?: readonly number[];
}

export interface JsonResponse<T> {
	status: number;
	body: T | null;
}

function retryAfterSeconds(response: Response): number | undefined {
	const header = response.headers.get('retry-after');
	if (!header) return undefined;
	const seconds = Number(header);
	if (Number.isFinite(seconds)) return Math.max(0, seconds);
	const at = Date.parse(header);
	return Number.isFinite(at) ? Math.max(0, Math.round((at - Date.now()) / 1000)) : undefined;
}

export async function fetchJson<T>(request: JsonRequest): Promise<JsonResponse<T>> {
	let response: Response;
	try {
		response = await request.fetch(request.url, {
			method: request.method ?? 'GET',
			headers: { accept: 'application/json', 'user-agent': SOURCE_USER_AGENT, ...request.headers },
			body: request.body,
			signal: request.signal,
		});
	} catch (err) {
		// An abort is the deadline speaking; let the orchestrator classify it as a timeout.
		if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) throw err;
		throw new NameSourceError('unavailable', `network failure (${err instanceof Error ? err.name : 'unknown'})`);
	}

	if (response.status === 429) {
		throw new NameSourceError('rate_limited', 'upstream asked us to back off', retryAfterSeconds(response));
	}
	if (request.pass?.includes(response.status)) {
		return { status: response.status, body: null };
	}
	if (!response.ok) {
		throw new NameSourceError('unavailable', `HTTP ${response.status}`);
	}

	try {
		return { status: response.status, body: (await response.json()) as T };
	} catch {
		throw new NameSourceError('unavailable', 'response was not JSON');
	}
}
