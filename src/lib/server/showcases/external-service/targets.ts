/**
 * Where the external service lives, decided on the server and nowhere else.
 *
 * A target is resolved from two server-only values — an origin and a credential — into one
 * of three setups. The page names a target by id (`local`, `remote`), never by URL, so a
 * caller cannot point the adapter anywhere: this is what keeps the lab from being a proxy.
 * Pure, so the rules are testable without an environment; `targets.adapter.ts` is the
 * one place that reads the environment.
 */
import type { ServiceTargetId, ServiceTargetProblem } from '$lib/showcases/external-service/types';
import { MIN_TOKEN_LENGTH } from './config';

export interface ServiceTarget {
	id: ServiceTargetId;
	/** Scheme + host + port only. Operation paths are joined onto it, never supplied. */
	origin: string;
	token: string;
}

export type ResolvedServiceTarget =
	| { id: ServiceTargetId; setup: 'configured'; target: ServiceTarget }
	| { id: ServiceTargetId; setup: 'unconfigured' }
	| { id: ServiceTargetId; setup: 'misconfigured'; problem: ServiceTargetProblem };

export interface RawServiceTarget {
	url: string | undefined;
	token: string | undefined;
}

export function resolveServiceTarget(id: ServiceTargetId, raw: RawServiceTarget): ResolvedServiceTarget {
	const url = raw.url?.trim() ?? '';
	const token = raw.token?.trim() ?? '';
	if (!url && !token) return { id, setup: 'unconfigured' };
	if (!url || !token) return { id, setup: 'misconfigured', problem: 'incomplete' };

	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return { id, setup: 'misconfigured', problem: 'invalid_url' };
	}
	if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
		return { id, setup: 'misconfigured', problem: 'invalid_url' };
	}
	if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
		return { id, setup: 'misconfigured', problem: 'not_an_origin' };
	}
	// A bearer credential crosses the network in this request: TLS, unless the host cannot be
	// on the public internet. The remote target must always use https; `local` may use plain
	// http only to loopback, a private address or a single-label (container network) name.
	if (parsed.protocol !== 'https:' && (id === 'remote' || !isPrivateHost(parsed.hostname))) {
		return { id, setup: 'misconfigured', problem: 'insecure_url' };
	}
	// The service's own startup rule: printable ASCII without spaces, so the value travels
	// unchanged in a header — a `fetch` with anything else throws before sending.
	if (!/^[\x21-\x7e]+$/.test(token)) return { id, setup: 'misconfigured', problem: 'malformed_token' };
	if (token.length < MIN_TOKEN_LENGTH) return { id, setup: 'misconfigured', problem: 'short_token' };

	return { id, setup: 'configured', target: { id, origin: parsed.origin, token } };
}

/**
 * Hosts a plain-http request cannot reach across the public internet: loopback, RFC 1918
 * and IPv6 unique-local addresses, `localhost`, and single-label names (a compose or
 * cluster network's service name, e.g. `order-rules`).
 */
export function isPrivateHost(hostname: string): boolean {
	const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
	if (host === 'localhost' || host.endsWith('.localhost')) return true;
	if (host === '::1' || /^f[cd][0-9a-f]{2}:/.test(host)) return true;
	const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
	if (v4) {
		const [a, b] = [Number(v4[1]), Number(v4[2])];
		return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
	}
	return !host.includes('.') && !host.includes(':');
}
