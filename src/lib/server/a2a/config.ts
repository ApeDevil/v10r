/**
 * The A2A domain's policy leaf: protocol constants and every bound on what crosses the wire,
 * in both directions. A2A traffic is untrusted on both legs — a public caller sends us a model,
 * and a peer we delegate to sends us findings — so each limit below is a refusal threshold,
 * never a truncation point.
 */
import { MODEL_LIMITS } from '#patterns/architecture-engineering/index.ts';

/** The A2A specification version this agent speaks (Agent Card `protocolVersion`, `A2A-Version` header). */
export const A2A_PROTOCOL_VERSION = '1.0';

/** The JSON-RPC binding's endpoint, relative to the deployment origin. */
export const A2A_ENDPOINT_PATH = '/api/a2a';

/**
 * The review agent's own release. It moves when the skills or the shape of their artifact
 * change — not with the app, so a peer can pin the contract it was built against.
 */
export const ARCHITECTURE_REVIEW_AGENT_VERSION = '1.0.0';

/** Bounds on an inbound JSON-RPC request (the server leg). */
export const A2A_SERVER_LIMITS = {
	/** The largest model an import accepts, plus room for the JSON-RPC and message envelope. */
	requestBytes: MODEL_LIMITS.fileBytes + 64 * 1024,
	/** Parts in one message: the model's data part plus a few short text parts. */
	messageParts: 4,
	/** Characters in one text part — instructions only; the model travels as data. */
	textPartChars: 2000,
} as const;

/** Bounds on a delegation to a peer (the client leg). */
export const A2A_CLIENT_LIMITS = {
	/** Wall-clock budget for the whole delegation: card fetch plus the send. */
	timeoutMs: 10_000,
	/** Bytes of any one response a peer may send (the card, or the JSON-RPC answer). */
	responseBytes: 512 * 1024,
	/** Findings kept from one peer; past this the claim is refused, not cut. */
	findings: 200,
	/** Characters per finding field a peer may send. */
	findingText: 2000,
	/** Characters of the peer's raw artifact kept on the claim for inspection. */
	rawChars: 16 * 1024,
	/** Events one streamed answer may carry before it is refused as invalid. */
	streamEvents: 64,
	/** Budget for the `CancelTask` sent after a timeout or abort — its own, the deadline already passed. */
	cancelMs: 3_000,
} as const;

/**
 * Bounds on assistant-driven delegation (`delegate_architecture_review`). A delegation sends
 * the user's model to another organisation's agent, so it is rare by construction: one per
 * turn, a few per conversation, and never from inside a delegated task (depth 1 — v10r's
 * own A2A skills run no assistant and never delegate).
 */
export const A2A_DELEGATION_LIMITS = {
	perTurn: 1,
	perConversation: 3,
	/** A human turn is depth 0; a delegation from it is depth 1, and nothing deeper is sent. */
	maxDepth: 1,
	/** How long a human's approval of one delegation stays executable. */
	approvalTtlMs: 10 * 60 * 1000,
} as const;

/** Message metadata key carrying the sender's delegation depth (1 for every v10r delegation). */
export const A2A_DELEGATION_DEPTH_KEY = 'v10r.delegationDepth';
