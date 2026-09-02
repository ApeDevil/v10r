/**
 * Bounded request-body readers.
 *
 * `request.json()` buffers and parses whatever arrives. Vercel caps a
 * serverless request body at roughly 4.5 MB, so there is a ceiling — but it is
 * a deployment limit, not a per-endpoint business budget, and it arrives as an
 * opaque platform 413 that no handler ever sees. An unauthenticated endpoint
 * that will never legitimately receive more than a few kilobytes should say so.
 *
 * The important structural point: **you cannot measure and then parse.** Reading
 * the stream to count bytes consumes it, so a size check followed by
 * `request.json()` throws on the second read. These helpers therefore do both
 * and return a discriminated result, which is also why they replace the
 * try/catch at a call site rather than sitting in front of one.
 */
import { apiError } from './response';

export type BoundedText = { ok: true; value: string } | { ok: false; reason: 'too_large' };
export type BoundedJson<T> = { ok: true; value: T } | { ok: false; reason: 'too_large' | 'invalid_json' };

/**
 * Global advisory floor, enforced in the hook chain. Set below Vercel's ~4.5 MB
 * platform cap on purpose: above it the check is dead code, because the
 * platform rejects first with its own opaque response. Below it, our
 * `{ error: { code, message } }` shape is what clients actually receive.
 */
export const MAX_REQUEST_BYTES = 4 * 1024 * 1024;

/** Budget for a JSON-RPC envelope. Generous for a tool call, tiny next to the floor. */
export const MAX_MCP_BODY_BYTES = 256 * 1024;

/** Budget for the anonymous analytics beacons. */
export const MAX_BEACON_BODY_BYTES = 64 * 1024;

/** Budget for AI conversation payloads — the largest legitimate bodies in the app. */
export const MAX_AI_BODY_BYTES = 1024 * 1024;

/**
 * Read at most `maxBytes` of the body as text. Returns `null` when the budget
 * is exceeded — the caller decides what that means.
 */
async function readBounded(request: Request, maxBytes: number): Promise<string | null> {
	// A declared oversize is refused before a single byte is read. This is the
	// cheap path and the common one for honest clients; it is not a control on
	// its own, because chunked encoding omits the header entirely and it is
	// optional in HTTP/2.
	const declared = Number(request.headers.get('content-length'));
	if (Number.isFinite(declared) && declared > maxBytes) return null;

	const body = request.body;
	if (!body || typeof body.getReader !== 'function') {
		// No readable stream (empty body, or a Request implementation without
		// one). Buffer and bound after the fact — correct, just not incremental.
		const buffered = await request.arrayBuffer();
		if (buffered.byteLength > maxBytes) return null;
		return new TextDecoder().decode(buffered);
	}

	const reader = body.getReader();
	const decoder = new TextDecoder();
	let total = 0;
	let out = '';
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > maxBytes) {
			// Stop pulling: the point of the budget is to not pay for the rest.
			await reader.cancel().catch(() => {});
			return null;
		}
		out += decoder.decode(value, { stream: true });
	}
	return out + decoder.decode();
}

/** Read the body as text, refusing anything over `maxBytes`. */
export async function readTextBounded(request: Request, maxBytes: number): Promise<BoundedText> {
	const text = await readBounded(request, maxBytes);
	return text === null ? { ok: false, reason: 'too_large' } : { ok: true, value: text };
}

/**
 * Read and parse the body as JSON, refusing anything over `maxBytes`.
 * An empty body is `invalid_json` — it is not valid JSON, and treating it as
 * `{}` would hand schema validation something the client never sent.
 */
export async function readJsonBounded<T = unknown>(request: Request, maxBytes: number): Promise<BoundedJson<T>> {
	const text = await readBounded(request, maxBytes);
	if (text === null) return { ok: false, reason: 'too_large' };
	if (text.length === 0) return { ok: false, reason: 'invalid_json' };
	try {
		return { ok: true, value: JSON.parse(text) as T };
	} catch {
		return { ok: false, reason: 'invalid_json' };
	}
}

/**
 * Standard 413. Deliberately states the budget: a client that guessed wrong
 * can correct itself, and the number is not a secret.
 */
export function payloadTooLargeResponse(maxBytes: number): Response {
	return apiError(413, 'payload_too_large', `Request body exceeds the ${Math.floor(maxBytes / 1024)} KB limit.`);
}
