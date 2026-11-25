/**
 * One JSON-RPC request into the review agent, served by the SDK's `JsonRpcTransportHandler` —
 * no Express. The SDK owns the protocol: envelope validation, method dispatch, `A2A-Version`
 * negotiation, task state rules and every JSON-RPC error code.
 *
 * Each request gets a FRESH `DefaultRequestHandler` over a FRESH `InMemoryTaskStore`. That is
 * the whole storage design, and it is acceptable only because no review task outlives its
 * request (`review-executor.ts` reaches a terminal state before `execute` returns). Two
 * consequences, both deliberate:
 *
 *   - `GetTask` / `CancelTask` / `SubscribeToTask` for an earlier task answer TaskNotFound, and
 *     `ListTasks` is empty. A store shared across requests on a warm serverless instance would
 *     instead let any anonymous caller list every other caller's models and findings.
 *   - Durable tasks (long-running reviews, push notifications, re-attaching to a stream after a
 *     cut) would need a database-backed `TaskStore` — a Drizzle implementation of the SDK's
 *     interface, scoped per caller. Not built; nothing here needs it.
 */
import { A2A_VERSION_HEADER } from '@a2a-js/sdk';
import {
	DefaultRequestHandler,
	InMemoryTaskStore,
	JsonRpcTransportHandler,
	ServerCallContext,
	validateVersion,
} from '@a2a-js/sdk/server';
import { buildArchitectureReviewCard } from './agent-card.ts';
import { ArchitectureReviewExecutor } from './review-executor.ts';

/** A JSON-RPC 2.0 response object as the SDK produces it. */
export interface A2aJsonRpcResponse {
	jsonrpc: string;
	id: string | number | null;
	result?: unknown;
	error?: unknown;
}

export type A2aAnswer =
	| { kind: 'json'; response: A2aJsonRpcResponse }
	| { kind: 'stream'; frames: AsyncGenerator<A2aJsonRpcResponse, void, undefined> };

export interface A2aCall {
	/** The deployment origin the card advertises (`https://host`). */
	origin: string;
	/** The `A2A-Version` header as sent; absent means 0.3 per the spec, which this agent refuses. */
	requestedVersion: string | null;
}

export { A2A_VERSION_HEADER };

function requestId(body: unknown): string | number | null {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
	const id = (body as { id?: unknown }).id;
	return typeof id === 'string' || typeof id === 'number' ? id : null;
}

/** Answer one parsed JSON-RPC body. Never throws: every failure is a JSON-RPC error envelope. */
export async function answerA2aJsonRpc(body: unknown, call: A2aCall): Promise<A2aAnswer> {
	const card = buildArchitectureReviewCard(call.origin);
	const handler = new DefaultRequestHandler(card, new InMemoryTaskStore(), new ArchitectureReviewExecutor());
	const context = new ServerCallContext({ requestedVersion: call.requestedVersion || undefined });
	const fail = (error: unknown): A2aAnswer => ({
		kind: 'json',
		response: { jsonrpc: '2.0', id: requestId(body), error: JsonRpcTransportHandler.mapToJSONRPCError(error) },
	});
	try {
		validateVersion(context.requestedVersion, card, 'JSONRPC');
		const answer = await new JsonRpcTransportHandler(handler).handle(body as Record<string, unknown>, context);
		if (typeof (answer as AsyncGenerator)[Symbol.asyncIterator] !== 'function') {
			return { kind: 'json', response: answer as A2aJsonRpcResponse };
		}
		return { kind: 'stream', frames: answer as AsyncGenerator<A2aJsonRpcResponse, void, undefined> };
	} catch (error) {
		return fail(error);
	}
}
