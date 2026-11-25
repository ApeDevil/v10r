/**
 * The operator's delegation peers — read from the deployment, never from a user or a model.
 *
 * `A2A_DELEGATION_PEERS` holds a JSON array of `A2aDelegationPeer` entries. Unset means no peer
 * and the `agent-delegation` capability stays inactive. An entry with a problem
 * (`delegationPeerProblems`) is dropped with a warning naming the peer id and the problem,
 * never the value of a secret (entries hold secret references only).
 */
import { type A2aDelegationPeer, delegationPeerProblems } from './delegation-peer.ts';

export const A2A_DELEGATION_PEERS_ENV = 'A2A_DELEGATION_PEERS';

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** Parse the operator's peer list; a malformed list yields no peers. */
export function parseDelegationPeers(raw: string | undefined): A2aDelegationPeer[] {
	if (!raw?.trim()) return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		console.warn(`[a2a] ${A2A_DELEGATION_PEERS_ENV} is not JSON; no delegation peers`);
		return [];
	}
	if (!Array.isArray(parsed)) {
		console.warn(`[a2a] ${A2A_DELEGATION_PEERS_ENV} is not an array; no delegation peers`);
		return [];
	}
	const peers: A2aDelegationPeer[] = [];
	for (const entry of parsed) {
		if (
			!isRecord(entry) ||
			typeof entry.id !== 'string' ||
			typeof entry.label !== 'string' ||
			typeof entry.origin !== 'string' ||
			!Array.isArray(entry.skills) ||
			!entry.skills.every((skill) => typeof skill === 'string') ||
			!isRecord(entry.auth)
		) {
			console.warn('[a2a] a delegation peer entry has the wrong shape; dropped');
			continue;
		}
		const peer = entry as unknown as A2aDelegationPeer;
		const problems = delegationPeerProblems(peer);
		if (problems.length > 0) {
			console.warn(`[a2a] delegation peer ${peer.id} dropped: ${problems.join(', ')}`);
			continue;
		}
		peers.push(peer);
	}
	return peers;
}

/** The deployment's delegation peers. */
export function loadDelegationPeers(env: Record<string, string | undefined> = process.env): A2aDelegationPeer[] {
	return parseDelegationPeers(env[A2A_DELEGATION_PEERS_ENV]);
}
