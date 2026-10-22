/**
 * Where the external service lives, decided on the server and nowhere else.
 *
 * A target is resolved from two server-only values — an origin and a credential — into one
 * of three setups. The page names a target by id (`local`, `remote`), never by URL, so a
 * caller cannot point the adapter anywhere: this is what keeps the lab from being a proxy.
 * Pure, so the rules are testable without an environment; `targets.adapter.ts` is the
 * one place that reads the environment.
 */
import type { ServiceTargetId } from '$lib/showcases/external-service/types';
import { MIN_TOKEN_LENGTH } from './config';

export interface ServiceTarget {
	id: ServiceTargetId;
	/** Scheme + host + port only. Operation paths are joined onto it, never supplied. */
	origin: string;
	token: string;
}

/** Why a set target was refused. Names the rule, never the value. */
export type ServiceTargetProblem = 'incomplete' | 'invalid_url' | 'not_an_origin' | 'insecure_url' | 'short_token';

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
	// The remote target crosses the public internet with a bearer credential: TLS or nothing.
	// Plain http is tolerated only for `local`, which is a container network or loopback.
	if (id === 'remote' && parsed.protocol !== 'https:') {
		return { id, setup: 'misconfigured', problem: 'insecure_url' };
	}
	if (token.length < MIN_TOKEN_LENGTH) return { id, setup: 'misconfigured', problem: 'short_token' };

	return { id, setup: 'configured', target: { id, origin: parsed.origin, token } };
}
