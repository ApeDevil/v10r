/**
 * Calling one peer tool — bounded in time, in size and in count, and wrapped before the model reads it.
 *
 * Before anything is sent the arguments pass `preparePeerArguments` (`disclosure.ts`): plain
 * JSON, valid against the tool's input schema, within the peer's size bound and field allowlist,
 * free of the peer's own secret. Only that canonical object goes out — the call has no other
 * input, so no conversation, document or credential can ride along.
 *
 * The SDK's own `callTool` validates `structuredContent` against the tool's `outputSchema` and
 * THROWS on a mismatch, which would turn a peer's sloppy (or hostile) result into a lost call.
 * The spec only asks clients to validate, so v10r passes the definition without its
 * `outputSchema` and validates itself: a conforming result keeps `structured`; a non-conforming
 * one is read as text and flagged, never trusted as typed data.
 *
 * Every outcome — success, the tool's own error, a timeout — comes back as one `PeerCallResult`
 * whose `text` is a single `<untrusted-content>` element (`wrapUntrusted`). Failure text is
 * v10r's own and generic: a transport exception's message never reaches the model. A result
 * that echoes the peer's bearer secret back is scrubbed (`credential_redacted`) — a hostile peer
 * must not be able to put v10r's credential into the model's context.
 */
import { type CallToolResult, SdkError, SdkErrorCode } from '@modelcontextprotocol/client';
import { wrapUntrusted } from '../untrusted-content';
import { MAX_PEER_RESULT_CHARS, PEER_CALL_TIMEOUT_MS, PEER_CALLS_PER_TURN } from './config';
import { conformsToSchema, preparePeerArguments } from './disclosure';
import { PeerEndpointError } from './endpoint-guard';
import type { PeerConnection } from './peer-tools';
import type { ProjectedPeerTool } from './projection';

export type PeerCallOutcome =
	| 'ok'
	| 'tool_error'
	| 'timeout'
	| 'cancelled'
	| 'response_too_large'
	| 'failed'
	| 'budget_exhausted'
	| 'disclosure_refused';

export type PeerCallFlag =
	| 'result_truncated'
	| 'structured_invalid'
	| 'structured_missing'
	| 'non_text_content'
	| 'credential_redacted';

export interface PeerCallResult {
	outcome: PeerCallOutcome;
	/** What the model reads: one escaped `<untrusted-content source="mcp_…">` element. */
	text: string;
	/** `structuredContent`, only when it conforms to the tool's `outputSchema` (or the tool has none). */
	structured?: unknown;
	flags: PeerCallFlag[];
}

/**
 * Peer calls left in one turn, across every peer — the per-turn analogue of `QueryBudget`. A peer
 * call is slow, costs the third party and sends data out, so a loop that keeps calling is cut off
 * by count, not only by the step budget.
 */
export interface PeerCallBudget {
	readonly remaining: number;
	/** Spends one call; false (and nothing spent) when none is left. */
	take(): boolean;
}

export function createPeerCallBudget(max = PEER_CALLS_PER_TURN): PeerCallBudget {
	let remaining = max;
	return {
		get remaining() {
			return remaining;
		},
		take() {
			if (remaining <= 0) return false;
			remaining--;
			return true;
		},
	};
}

export interface CallPeerToolOptions {
	timeoutMs?: number;
	/** The turn's cancellation; the in-flight request is abandoned when it fires. */
	signal?: AbortSignal;
	budget?: PeerCallBudget;
	maxResultChars?: number;
}

const REDACTED = '[credential redacted by v10r]';

/** Replaces every occurrence of the peer's resolved secret (raw and JSON-escaped) in `text`. */
function scrub(connection: PeerConnection, text: string, flags: Set<PeerCallFlag>): string {
	const { auth } = connection.peer;
	if (auth.kind !== 'bearer') return text;
	const secret = connection.resolveSecret(auth.secretRef);
	if (!secret) return text;
	let out = text;
	for (const form of new Set([secret, JSON.stringify(secret).slice(1, -1)])) {
		if (form && out.includes(form)) {
			out = out.split(form).join(REDACTED);
			flags.add('credential_redacted');
		}
	}
	return out;
}

function bounded(text: string, max: number, flags: Set<PeerCallFlag>): string {
	if (text.length <= max) return text;
	flags.add('result_truncated');
	return `${text.slice(0, max)}\n[… truncated by v10r: the peer returned ${text.length} characters]`;
}

/** One `PeerCallResult` whose text is v10r's own (a refusal, a failure) — never peer bytes. */
export function settledPeerCall(source: string, outcome: PeerCallOutcome, text: string): PeerCallResult {
	return { outcome, text: wrapUntrusted(source, text), flags: [] };
}

/** Text of a result: its text blocks, a placeholder for every other block. */
function resultText(result: CallToolResult, flags: Set<PeerCallFlag>): string {
	const parts: string[] = [];
	for (const block of result.content ?? []) {
		if (block.type === 'text') parts.push(block.text);
		else {
			flags.add('non_text_content');
			parts.push(`[${block.type} content omitted]`);
		}
	}
	return parts.join('\n');
}

/**
 * A peer's answer, read the way the model may see it: text blocks joined, `structuredContent`
 * kept only when it conforms, the secret scrubbed, the size bounded, the whole wrapped.
 */
export function readPeerCallResult(
	connection: PeerConnection,
	projected: ProjectedPeerTool,
	result: CallToolResult,
	maxChars = MAX_PEER_RESULT_CHARS,
): PeerCallResult {
	const source = projected.descriptor.name;
	const flags = new Set<PeerCallFlag>();
	const outputSchema = projected.tool.outputSchema;
	let text = resultText(result, flags);
	let structured: unknown;
	if (result.structuredContent !== undefined) {
		if (!outputSchema || conformsToSchema(outputSchema, result.structuredContent) === true) {
			structured = result.structuredContent;
			// The spec asks servers to mirror structured results in a text block; not all do.
			if (text === '') text = JSON.stringify(structured);
		} else {
			flags.add('structured_invalid');
			text = [text, JSON.stringify(result.structuredContent)].filter(Boolean).join('\n');
		}
	} else if (outputSchema && !result.isError) {
		flags.add('structured_missing');
	}

	text = scrub(connection, text, flags);
	if (structured !== undefined) {
		const serialized = JSON.stringify(structured);
		const clean = scrub(connection, serialized, new Set());
		// A structured result that carried the secret is dropped as data; its scrubbed text stays.
		if (clean !== serialized) {
			flags.add('credential_redacted');
			structured = undefined;
		} else if (serialized.length > maxChars) {
			flags.add('result_truncated');
			structured = undefined;
		}
	}
	const outcome: PeerCallOutcome = result.isError ? 'tool_error' : 'ok';
	return {
		outcome,
		text: wrapUntrusted(source, bounded(text, maxChars, flags)),
		...(structured !== undefined ? { structured } : {}),
		flags: [...flags],
	};
}

/** The tool's definition for the SDK's header mirroring, without the `outputSchema` it would throw on. */
export function callDefinition(projected: ProjectedPeerTool) {
	const { outputSchema: _ignored, ...definition } = projected.tool.definition;
	return definition;
}

/** The guarded fetch's byte cap, however deep the SDK wrapped it. */
export function isResponseTooLarge(error: unknown): boolean {
	for (let e: unknown = error, depth = 0; e && depth < 5; depth++) {
		if (e instanceof PeerEndpointError && e.problem === 'response_too_large') return true;
		e = (e as { cause?: unknown }).cause;
	}
	return /exceeded the byte cap/.test(String((error as Error)?.message ?? ''));
}

export function isRequestTimeout(error: unknown): boolean {
	return error instanceof SdkError && error.code === SdkErrorCode.RequestTimeout;
}

export async function callPeerTool(
	connection: PeerConnection,
	projected: ProjectedPeerTool,
	args: Record<string, unknown>,
	options: CallPeerToolOptions = {},
): Promise<PeerCallResult> {
	const source = projected.descriptor.name;
	const prepared = preparePeerArguments(connection.peer, projected.tool, args, connection.resolveSecret);
	if (!prepared.ok) {
		return settledPeerCall(
			source,
			'disclosure_refused',
			`v10r did not send this call: its arguments failed the disclosure check (${prepared.reason}).`,
		);
	}
	if (options.budget && !options.budget.take()) {
		return settledPeerCall(source, 'budget_exhausted', 'No external tool calls are left in this turn.');
	}
	let result: CallToolResult;
	try {
		result = await connection.client.callTool(
			{ name: projected.descriptor.remoteName, arguments: prepared.arguments },
			{
				timeout: options.timeoutMs ?? PEER_CALL_TIMEOUT_MS,
				signal: options.signal,
				toolDefinition: callDefinition(projected),
			},
		);
	} catch (error) {
		if (options.signal?.aborted) return settledPeerCall(source, 'cancelled', 'The call was cancelled.');
		if (isRequestTimeout(error)) return settledPeerCall(source, 'timeout', 'The external tool did not answer in time.');
		if (isResponseTooLarge(error)) {
			return settledPeerCall(source, 'response_too_large', 'The external tool answered more than v10r reads.');
		}
		return settledPeerCall(source, 'failed', 'The external tool call failed.');
	}
	return readPeerCallResult(connection, projected, result, options.maxResultChars ?? MAX_PEER_RESULT_CHARS);
}
