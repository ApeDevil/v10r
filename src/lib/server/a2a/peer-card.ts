/**
 * Agent discovery for a delegation: reading an A2A peer's Agent Card through the secured
 * transport, and the digest an approval binds to.
 *
 * A card is the peer's self-description — not identity proof and not authority. It is read
 * only to learn where the JSON-RPC interface is and what the peer says its skill does; the
 * operator's allowlist decides whether the peer may be asked at all. The digest covers what a
 * human approved against (name, version, interfaces, the chosen skill, streaming): a card that
 * changes any of it between approval and execution refuses the delegation.
 */
import { createHash } from 'node:crypto';
import type { AgentCard } from '@a2a-js/sdk';
import { DefaultAgentCardResolver } from '@a2a-js/sdk/client';
import { canonicalJson } from '#lib/utils/canonical-json.ts';
import { A2A_CLIENT_LIMITS } from './config.ts';
import { type A2aTransportOptions, createA2aPeerFetch, type FetchRefusalCode } from './guarded-fetch.ts';
import type { PeerPolicy } from './peer-policy.ts';

export interface PeerAgentIdentity {
	/** As the peer's card states it — self-description, not identity proof. */
	name: string;
	version: string;
}

export function cut(text: string, max: number): string {
	return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function peerAgentIdentity(card: AgentCard): PeerAgentIdentity {
	return { name: cut(String(card.name ?? ''), 120), version: cut(String(card.version ?? ''), 40) };
}

/** sha-256 of the card fields a delegation approval binds, for one skill. */
export function peerCardDigest(card: AgentCard, skill: string): string {
	const entry = card.skills?.find((s) => s.id === skill);
	const bound = {
		name: card.name ?? '',
		version: card.version ?? '',
		interfaces: (card.supportedInterfaces ?? []).map((i) => ({
			url: i.url,
			binding: i.protocolBinding,
			version: i.protocolVersion,
		})),
		streaming: card.capabilities?.streaming === true,
		skill: entry
			? {
					id: entry.id,
					name: entry.name,
					description: entry.description,
					inputModes: entry.inputModes ?? [],
					outputModes: entry.outputModes ?? [],
				}
			: null,
	};
	return createHash('sha256').update(canonicalJson(bound)).digest('hex');
}

export type PeerCardRead =
	| { ok: true; card: AgentCard; agent: PeerAgentIdentity }
	| { ok: false; code: FetchRefusalCode | 'timeout' | 'aborted' | 'transport'; message: string };

export interface PeerCardOptions extends A2aTransportOptions {
	policy: PeerPolicy;
	signal?: AbortSignal;
	timeoutMs?: number;
	bearerSecret?: () => string | undefined;
}

/** Fetch and parse the card at `peer` (an origin) through the secured transport. Sends no task. */
export async function readPeerCard(peer: string, options: PeerCardOptions): Promise<PeerCardRead> {
	const deadline = AbortSignal.timeout(options.timeoutMs ?? A2A_CLIENT_LIMITS.timeoutMs);
	const signal = options.signal ? AbortSignal.any([deadline, options.signal]) : deadline;
	const guarded = createA2aPeerFetch({ ...options, signal, responseBytes: A2A_CLIENT_LIMITS.responseBytes });
	try {
		const card = await new DefaultAgentCardResolver({ fetchImpl: guarded.fetch }).resolve(peer);
		return { ok: true, card, agent: peerAgentIdentity(card) };
	} catch (error) {
		const refusal = guarded.refusal();
		if (refusal) return { ok: false, code: refusal.code, message: refusal.message };
		if (deadline.aborted) return { ok: false, code: 'timeout', message: 'the peer card did not arrive in time' };
		if (options.signal?.aborted) return { ok: false, code: 'aborted', message: 'the card fetch was aborted' };
		return { ok: false, code: 'transport', message: cut(error instanceof Error ? error.message : String(error), 300) };
	}
}
