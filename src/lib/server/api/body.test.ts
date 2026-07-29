import { describe, expect, it } from 'vitest';
import { payloadTooLargeResponse, readJsonBounded, readTextBounded } from './body';

function post(body: BodyInit | null, headers: Record<string, string> = {}): Request {
	return new Request('https://example.test/x', { method: 'POST', body, headers });
}

/** A body with no Content-Length — the case the declared-size check cannot catch. */
function chunked(chunks: string[]): Request {
	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
			controller.close();
		},
	});
	// @ts-expect-error duplex is required for a stream body and is not in the DOM lib types
	return new Request('https://example.test/x', { method: 'POST', body: stream, duplex: 'half' });
}

describe('readJsonBounded', () => {
	it('parses a body within budget', async () => {
		await expect(readJsonBounded(post('{"a":1}'), 1024)).resolves.toEqual({ ok: true, value: { a: 1 } });
	});

	it('refuses a declared oversize without reading the body', async () => {
		// Content-Length lies about a small body: if the check consulted the actual
		// bytes it would pass, so a refusal proves the header short-circuit ran.
		const request = post('{}', { 'content-length': '9999' });
		await expect(readJsonBounded(request, 128)).resolves.toEqual({ ok: false, reason: 'too_large' });
		expect(request.bodyUsed).toBe(false);
	});

	it('refuses an undeclared oversize by counting bytes off the stream', async () => {
		const result = await readJsonBounded(chunked(['{"a":"', 'x'.repeat(500), '"}']), 128);
		expect(result).toEqual({ ok: false, reason: 'too_large' });
	});

	it('accepts an undeclared body that fits', async () => {
		await expect(readJsonBounded(chunked(['{"a":', '1}']), 128)).resolves.toEqual({ ok: true, value: { a: 1 } });
	});

	it('distinguishes invalid JSON from oversize', async () => {
		await expect(readJsonBounded(post('not json'), 1024)).resolves.toEqual({ ok: false, reason: 'invalid_json' });
	});

	it('treats an empty body as invalid JSON, not as {}', async () => {
		// Defaulting to {} would hand schema validation something the client never
		// sent, turning a malformed request into a confusing validation error.
		await expect(readJsonBounded(post(null), 1024)).resolves.toEqual({ ok: false, reason: 'invalid_json' });
	});

	it('accepts a body exactly at the budget and refuses one byte more', async () => {
		const exact = `"${'a'.repeat(8)}"`; // 10 bytes
		await expect(readJsonBounded(chunked([exact]), 10)).resolves.toEqual({ ok: true, value: 'aaaaaaaa' });
		await expect(readJsonBounded(chunked([exact]), 9)).resolves.toEqual({ ok: false, reason: 'too_large' });
	});

	it('counts bytes, not characters', async () => {
		// A 4-byte emoji is one JS character; a character-based budget would let
		// a caller send four times the intended payload.
		const body = '"🙂🙂"'; // 2 quotes + 8 bytes
		await expect(readJsonBounded(chunked([body]), 9)).resolves.toEqual({ ok: false, reason: 'too_large' });
		await expect(readJsonBounded(chunked([body]), 10)).resolves.toEqual({ ok: true, value: '🙂🙂' });
	});

	it('decodes multi-byte sequences split across chunk boundaries', async () => {
		const encoded = new TextEncoder().encode('"héllo"');
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				// Split mid-way through the two-byte 'é'.
				controller.enqueue(encoded.slice(0, 3));
				controller.enqueue(encoded.slice(3));
				controller.close();
			},
		});
		// @ts-expect-error duplex is required for a stream body and is not in the DOM lib types
		const request = new Request('https://example.test/x', { method: 'POST', body: stream, duplex: 'half' });
		await expect(readJsonBounded(request, 64)).resolves.toEqual({ ok: true, value: 'héllo' });
	});
});

describe('readTextBounded', () => {
	it('returns text within budget', async () => {
		await expect(readTextBounded(post('# hello'), 1024)).resolves.toEqual({ ok: true, value: '# hello' });
	});

	it('refuses oversize text', async () => {
		await expect(readTextBounded(chunked(['x'.repeat(300)]), 128)).resolves.toEqual({
			ok: false,
			reason: 'too_large',
		});
	});

	it('returns an empty string for an empty body rather than failing', async () => {
		await expect(readTextBounded(post(null), 1024)).resolves.toEqual({ ok: true, value: '' });
	});
});

describe('payloadTooLargeResponse', () => {
	it('emits 413 in the standard error shape', async () => {
		const response = payloadTooLargeResponse(256 * 1024);
		expect(response.status).toBe(413);
		const body = (await response.json()) as { error: { code: string; message: string } };
		expect(body.error.code).toBe('payload_too_large');
		expect(body.error.message).toContain('256 KB');
		// The MCP transport reuses this shape for its 413; keep it free of any
		// JSON-RPC envelope, which newer clients branch on.
		expect(body).not.toHaveProperty('jsonrpc');
	});
});
