/**
 * The A2A JSON-RPC binding over a web-standard `Request` → `Response`. Shared by the SvelteKit
 * route (`src/routes/api/a2a/+server.ts`) and the interop harness's `Bun.serve`
 * (`scripts/a2a/interop.ts`), so the conformance run exercises the code that ships.
 *
 * What the SDK leaves to the host, and this file therefore owns (mirroring the SDK's own Express
 * `jsonRpcHandler`):
 *   - the byte budget: the body is read once under `A2A_SERVER_LIMITS.requestBytes`, 413 past it;
 *   - Content-Type (`application/json` or absent) and JSON parse errors, as JSON-RPC errors;
 *   - the SSE framing of a streaming answer: `data: <json>\n\n` per frame. The first frame is
 *     pulled BEFORE the response is committed, so a request the SDK refuses up front still
 *     answers as plain JSON rather than as a stream holding a single error.
 *
 * Rate limiting stays in the route, before this runs.
 */
import { A2A_ERROR_CODE, ContentTypeNotSupportedError } from '@a2a-js/sdk/errors';
import { JsonRpcTransportHandler } from '@a2a-js/sdk/server';
import { readJsonBounded } from '#lib/server/http/body.ts';
import { A2A_SERVER_LIMITS } from './config.ts';
import { A2A_VERSION_HEADER, type A2aJsonRpcResponse, answerA2aJsonRpc } from './transport.ts';

const SSE_HEADERS = {
	'Content-Type': 'text/event-stream',
	'Cache-Control': 'no-cache',
	'X-Accel-Buffering': 'no',
} as const;

function rpcError(status: number, code: number, message: string): Response {
	return Response.json({ jsonrpc: '2.0', id: null, error: { code, message } }, { status });
}

function sseFrame(frame: A2aJsonRpcResponse, event?: 'error'): string {
	return `${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(frame)}\n\n`;
}

/** 405 for anything but POST — the JSON-RPC binding has no GET surface. */
export function a2aMethodNotAllowed(): Response {
	return rpcError(405, A2A_ERROR_CODE.INVALID_REQUEST, 'The A2A JSON-RPC endpoint accepts POST only.');
}

/** Serve one POST. `origin` is the deployment origin the Agent Card advertises. */
export async function respondToA2aPost(request: Request, origin: string): Promise<Response> {
	const contentType = request.headers.get('content-type');
	if (contentType && contentType.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
		const error = JsonRpcTransportHandler.mapToJSONRPCError(
			new ContentTypeNotSupportedError('Unsupported Content-Type; expected application/json.'),
		);
		return Response.json({ jsonrpc: '2.0', id: null, error }, { status: 415 });
	}

	const body = await readJsonBounded(request, A2A_SERVER_LIMITS.requestBytes);
	if (!body.ok) {
		return body.reason === 'too_large'
			? rpcError(
					413,
					A2A_ERROR_CODE.INVALID_REQUEST,
					`Request body exceeds the ${Math.floor(A2A_SERVER_LIMITS.requestBytes / 1024)} KB limit.`,
				)
			: rpcError(200, A2A_ERROR_CODE.PARSE_ERROR, 'Invalid JSON payload.');
	}

	const answer = await answerA2aJsonRpc(body.value, {
		origin,
		requestedVersion: request.headers.get(A2A_VERSION_HEADER),
	});
	if (answer.kind === 'json') {
		const isServerFault =
			(answer.response.error as { code?: number } | undefined)?.code === A2A_ERROR_CODE.INTERNAL_ERROR;
		return Response.json(answer.response, { status: isServerFault ? 500 : 200 });
	}

	const frames = answer.frames;
	let first: IteratorResult<A2aJsonRpcResponse, void>;
	try {
		first = await frames.next();
	} catch (error) {
		return Response.json({ jsonrpc: '2.0', id: null, error: JsonRpcTransportHandler.mapToJSONRPCError(error) });
	}

	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			if (!first.done) controller.enqueue(encoder.encode(sseFrame(first.value)));
		},
		async pull(controller) {
			try {
				const next = await frames.next();
				if (next.done) controller.close();
				else controller.enqueue(encoder.encode(sseFrame(next.value)));
			} catch (error) {
				const frame = { jsonrpc: '2.0', id: null, error: JsonRpcTransportHandler.mapToJSONRPCError(error) };
				controller.enqueue(encoder.encode(sseFrame(frame, 'error')));
				controller.close();
			}
		},
		async cancel() {
			await frames.return(undefined);
		},
	});
	return new Response(stream, { status: 200, headers: SSE_HEADERS });
}
