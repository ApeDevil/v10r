/**
 * External operations — the one contract for an assistant action that leaves the deployment:
 * an MCP peer tool call (`protocol: 'mcp'`) or an A2A delegation (`protocol: 'a2a'`).
 *
 * The domain behind it owns what is common to both: the human approval, the disclosure the
 * user authorizes, the persistent atomic execution claim, the receipt, and the rule that a
 * possibly-sent mutation is never retried. Each protocol plugs in through one
 * `ExternalOperationAdapter`; protocol-specific policy (MCP fingerprints, A2A agent cards,
 * destination rules) stays in that adapter, the pinned transport stays in
 * `#lib/server/http/pinned-fetch.ts`.
 *
 * Authority never comes from the protocol. A peer's tool annotations, an agent card's skill
 * list or a remote result grant nothing: the operator's peer policy sets the risk, the user's
 * approval authorizes one exact operation, and every remote answer is untrusted content and a
 * claim, not a verified fact.
 *
 * This file is the contract (Phase III, 2026-11-24): types that the MCP and A2A work implement
 * against. Persistence lives in `#lib/server/db/schema/ai/external-operation.ts`, the execution
 * in `execution.ts`, the disclosure rule in `content-screen.ts`. An adapter is registered by
 * passing it in `ExternalOperationAdapters` — the domain imports no protocol.
 */

export type ExternalProtocol = 'mcp' | 'a2a';

/** What the operator says undoing a successful operation takes — never inferred from the peer. */
export type ExternalReversibility = 'reversible' | 'compensatable' | 'irreversible' | 'unknown';

/**
 * What the arguments carry beyond what the model composed (`content-screen.ts`):
 * `arguments_only` — nothing the turn read; `quotes_read_content` — they quote text a tool
 * result put in front of the model this turn (a desk document, a retrieved chunk, another
 * peer's answer). The second is disclosed only with its own explicit authorization: an
 * operator's field allowlist says WHICH fields may leave, never that confidential content
 * may ride in them. Secrets are not a class — arguments carrying one are refused outright.
 */
export type ExternalContentClass = 'arguments_only' | 'quotes_read_content';

/**
 * Everything the user is shown before approving, and nothing less. A disclosure is
 * authorized separately from a mutation: approving a read still discloses its arguments.
 */
export interface ExternalDisclosure {
	protocol: ExternalProtocol;
	/** Operator-configured peer id and its display label. */
	peerId: string;
	peerLabel: string;
	/** Origin the request goes to (`https://peer.example`), never a full URL with secrets. */
	destination: string;
	/** The remote operation: MCP tool name, or A2A skill id. */
	operation: string;
	/** The exact top-level fields sent, and a redacted preview of their values. */
	fields: readonly string[];
	preview: string;
	bytes: number;
	/** Whose credential the peer sees: none, or the operator's named secret reference (never its value). */
	credential: { kind: 'none' } | { kind: 'operator_secret'; ref: string };
	/** Whether persistent data on the peer may change. */
	mutates: boolean;
	reversibility: ExternalReversibility;
	/** Approvals are for one operation; nothing is remembered as a standing grant. */
	grant: 'once';
	/** Set by the domain's content screen, never by an adapter. */
	contentClass: ExternalContentClass;
	/** The tools whose results the arguments quote (empty for `arguments_only`). */
	quotedFrom: readonly string[];
	/**
	 * Values the protocol adds to the request beside the arguments — A2A's message metadata
	 * (skill, delegation depth). Shown with the complete arguments; not part of their digest,
	 * since the adapter sets them, not the model. Absent: the arguments are all that is sent.
	 */
	envelope?: readonly ExternalEnvelopeField[];
}

/** One value a protocol adds to the request beside the arguments. */
export interface ExternalEnvelopeField {
	field: string;
	value: string;
}

/** What an adapter's `prepare` describes; the domain adds the content screen's verdict. */
export type ExternalDisclosureDraft = Omit<ExternalDisclosure, 'contentClass' | 'quotedFrom'>;

/** Text the turn read from a tool result — what the content screen compares arguments with. */
export interface ExternalReadContent {
	/** The tool whose result carried it. */
	source: string;
	text: string;
}

/** What the approval binds; any difference at execution time refuses the call. */
export interface ExternalOperationBinding {
	protocol: ExternalProtocol;
	peerId: string;
	endpoint: string;
	operation: string;
	/** MCP tool fingerprint, or the A2A agent card + skill digest. */
	contractDigest: string;
	/** Digest of the operator's policy for this operation at proposal time. */
	policyDigest: string;
	/** Digest of the canonical JSON of the exact arguments. */
	argumentsDigest: string;
	userId: string;
	expiresAt: string;
}

export interface ExternalOperationRequest {
	protocol: ExternalProtocol;
	peerId: string;
	operation: string;
	arguments: unknown;
	userId: string;
	conversationId: string | null;
	/** What the turn read before proposing (content screen input); never sent anywhere. */
	readContent?: readonly ExternalReadContent[];
}

export type ExternalPreparation =
	| { ok: true; disclosure: ExternalDisclosureDraft; binding: ExternalOperationBinding }
	| { ok: false; reason: string };

/** The four outcomes, each a claim of different strength (see `mcp-client/approved-execution.ts`). */
export type ExternalOutcome = 'succeeded' | 'failed' | 'unknown' | 'refused';
export type ExternalDelivery = 'not_sent' | 'sent' | 'possibly_sent';

export interface ExternalExecutionResult {
	outcome: ExternalOutcome;
	delivery: ExternalDelivery;
	/** The peer's answer, bounded and wrapped as untrusted content. Absent when nothing came back. */
	result?: string;
	/** A machine reason for `failed` / `refused` / `unknown` (no peer text, no secrets). */
	reason?: string;
	/**
	 * The ids the peer gave the remote work (A2A task and context), recorded beside the turn
	 * for trace correlation (`ToolExecutionRecord.remoteTask`). Peer-chosen: an id to look the
	 * remote side up by, never an identity or a proof. Added 2026-11-24 for A2A delegation.
	 */
	remoteTask?: ExternalRemoteTask;
}

export interface ExternalRemoteTask {
	taskId: string | null;
	contextId: string | null;
}

/**
 * One protocol's half of an external operation. `prepare` runs when the model proposes the
 * operation (nothing is sent); `verify` and `execute` run after approval, inside the domain's
 * execution claim. `execute` is called at most once per approval and must not retry.
 */
export interface ExternalOperationAdapter {
	protocol: ExternalProtocol;
	prepare(request: ExternalOperationRequest): Promise<ExternalPreparation>;
	verify(binding: ExternalOperationBinding): Promise<{ ok: true } | { ok: false; reason: string }>;
	execute(
		request: ExternalOperationRequest,
		binding: ExternalOperationBinding,
		signal: AbortSignal,
	): Promise<ExternalExecutionResult>;
}

/** The registration point: one adapter per protocol, supplied by the composition root. */
export type ExternalOperationAdapters = Partial<Record<ExternalProtocol, ExternalOperationAdapter>>;
