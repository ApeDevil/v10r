/**
 * Serve one orchestrator turn as an AG-UI run — the endpoint's stream half.
 *
 * The orchestrator answers every turn with the AI SDK UI message stream. This reads that
 * stream back, chunk by chunk, through the projector (`ui-stream-to-ag-ui.ts`) under an
 * export policy, and writes AG-UI events as server-sent events. No second agent runtime: the
 * turn is the deskbot's own, with its tools, its approval boundary and its trace.
 *
 * What this adds to the projection, and why it is the endpoint's and not the policy's:
 *
 *   - `CUSTOM v10r.thread { conversationId }` right after `RUN_STARTED` — the server-side
 *     thread this run was stored under, the caller's own id. An AG-UI `threadId` is chosen
 *     by the client; the next run names the conversation through `forwardedProps`.
 *   - `CUSTOM v10r.proposal { proposalId, status: 'pending' }` once a turn stopped at the
 *     approval boundary — the handle the user's decision is reported against, through
 *     `POST /api/ai/proposals/[id]/approve`. It carries no goal, step, argument or target:
 *     those stay behind the policy (`metadataKeys: ['harness']`).
 *   - every `TOOL_CALL_RESULT` leaves under a ticket as its `messageId`
 *     (`tool-result-ticket.ts`), which is how the next run tells the server's own replayed
 *     result from a forged one.
 *   - cancellation: when the request's own signal fired before the turn finished, the run
 *     ends `RUN_ERROR { code: 'cancelled' }`, never `RUN_FINISHED` — the orchestrator closes a
 *     cancelled message with an ordinary `finish`. Cancelling this body cancels the
 *     orchestrator's, which aborts every model call of the turn (`http/cancellation.ts`).
 *   - a stream that ends without a terminal chunk still ends the run (`RUN_ERROR`), and a run
 *     that never opened still opens first, so a client never sees a dangling run.
 *
 * Framing is the SSE AG-UI's `@ag-ui/encoder` writes for `text/event-stream`: one
 * `data: <json>\n\n` per event. The encoder package is not a runtime dependency because it
 * pulls the protobuf transport with it; the framing is three lines and the official client
 * parses it in the endpoint's tests.
 */
import { parseJsonEventStream, type UIMessageChunk, uiMessageChunkSchema } from 'ai';
import { issueToolResultTicket } from './tool-result-ticket';
import {
	AG_UI_DEFAULT_EXPORT_POLICY,
	type AgUiEvent,
	type AgUiExportPolicy,
	type AgUiRun,
	createAgUiProjector,
} from './ui-stream-to-ag-ui';

const AG_UI_SSE_HEADERS = {
	'content-type': 'text/event-stream',
	'cache-control': 'no-cache',
	connection: 'keep-alive',
	'x-accel-buffering': 'no',
} as const;

interface AgUiRunOptions {
	run: AgUiRun;
	/** Bound into every tool result ticket: a ticket replays only for the user it was issued to. */
	userId: string;
	/** The request's own signal: fired means the client left, so the run ended as cancelled. */
	signal?: AbortSignal;
	/** What the client may see. The endpoint passes nothing: the deny-by-default policy. */
	policy?: AgUiExportPolicy;
	/** Every event as it is written — a test's or an operator's view of the run. */
	onEvent?: (event: AgUiEvent) => void;
}

const encoder = new TextEncoder();

/** One AG-UI event as an SSE frame. */
function encodeAgUiEvent(event: AgUiEvent): Uint8Array {
	return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

function proposalIdOf(chunk: UIMessageChunk): string | null {
	if (chunk.type !== 'message-metadata') return null;
	const harness = (chunk.messageMetadata as { harness?: { proposal?: { id?: unknown } } } | undefined)?.harness;
	return typeof harness?.proposal?.id === 'string' ? harness.proposal.id : null;
}

/**
 * The orchestrator's answer as an AG-UI response. A refusal the orchestrator answered before
 * any stream existed (no provider, an unknown conversation, a database failure) is not a run:
 * it passes through as the JSON error it is, with its status.
 */
export function serveAgUiRun(orchestrated: Response, options: AgUiRunOptions): Response {
	const contentType = orchestrated.headers.get('content-type') ?? '';
	if (!orchestrated.ok || !orchestrated.body || !contentType.includes('text/event-stream')) return orchestrated;

	const { run, userId, signal } = options;
	const projector = createAgUiProjector(run, options.policy ?? AG_UI_DEFAULT_EXPORT_POLICY);
	const conversationId = orchestrated.headers.get('x-conversation-id');
	const chunks = parseJsonEventStream({ stream: orchestrated.body, schema: uiMessageChunkSchema }).getReader();

	let started = false;
	let ended = false;
	let proposalAnnounced = false;
	const toolNames = new Map<string, string>();
	const toolArgs = new Map<string, string>();

	/** The projector's events for one chunk, with what this endpoint adds to them. */
	function eventsFor(chunk: UIMessageChunk): AgUiEvent[] {
		const cancelled = signal?.aborted === true;
		const projected = projector.push(chunk.type === 'finish' && cancelled ? { type: 'abort' } : chunk);
		const events: AgUiEvent[] = [];
		for (const event of projected) {
			switch (event.type) {
				case 'RUN_STARTED':
					started = true;
					events.push(event);
					if (conversationId) events.push({ type: 'CUSTOM', name: 'v10r.thread', value: { conversationId } });
					continue;
				case 'TOOL_CALL_START':
					toolNames.set(event.toolCallId as string, event.toolCallName as string);
					break;
				case 'TOOL_CALL_ARGS': {
					const id = event.toolCallId as string;
					toolArgs.set(id, (toolArgs.get(id) ?? '') + (event.delta as string));
					break;
				}
				case 'TOOL_CALL_RESULT': {
					const toolCallId = event.toolCallId as string;
					const messageId = issueToolResultTicket({
						userId,
						toolCallId,
						toolName: toolNames.get(toolCallId) ?? '',
						args: toolArgs.get(toolCallId) ?? '',
						content: event.content as string,
					});
					events.push({ ...event, messageId });
					continue;
				}
				case 'RUN_FINISHED':
				case 'RUN_ERROR':
					ended = true;
					break;
			}
			events.push(event);
		}
		const proposalId = proposalIdOf(chunk);
		if (proposalId && !proposalAnnounced && !ended) {
			proposalAnnounced = true;
			events.push({ type: 'CUSTOM', name: 'v10r.proposal', value: { proposalId, status: 'pending' } });
		}
		return events;
	}

	/** What closes a stream that ended (or broke) without a terminal chunk. */
	function closingEvents(): AgUiEvent[] {
		if (ended) return [];
		const opening = started ? [] : eventsFor({ type: 'start' });
		return [
			...opening,
			...projector.push(
				signal?.aborted ? { type: 'abort' } : { type: 'error', errorText: 'The turn ended without finishing.' },
			),
		];
	}

	const body = new ReadableStream<Uint8Array>({
		// Reads until at least one event is written: a chunk the policy withholds yields none, and a
		// `pull` that enqueues nothing is not called again — the stream would stall on it.
		async pull(controller) {
			let written = 0;
			const write = (events: AgUiEvent[]) => {
				for (const event of events) {
					options.onEvent?.(event);
					controller.enqueue(encodeAgUiEvent(event));
					written += 1;
				}
			};
			try {
				while (written === 0) {
					const next = await chunks.read();
					if (next.done) {
						write(closingEvents());
						controller.close();
						return;
					}
					if (!next.value.success) {
						// A frame that is not a UI message chunk: the turn's stream is not what it claims.
						write(closingEvents());
						controller.close();
						await chunks.cancel();
						return;
					}
					write(eventsFor(next.value.value));
				}
			} catch {
				write(closingEvents());
				controller.close();
			}
		},
		cancel(reason) {
			// The client left: the orchestrator's body is cancelled, which aborts its model calls.
			return chunks.cancel(reason);
		},
	});

	const headers = new Headers(AG_UI_SSE_HEADERS);
	if (conversationId) headers.set('x-conversation-id', conversationId);
	return new Response(body, { status: 200, headers });
}
