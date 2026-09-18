import { describe, expect, it } from 'vitest';
import { SOURCE_USER_AGENT } from './config';
import type { NameSourceError } from './errors';
import { fetchJson } from './fetch-json';

function answering(response: Response): { fetch: typeof fetch; headers: Headers[] } {
	const headers: Headers[] = [];
	const fetchImpl: typeof fetch = async (_url, init) => {
		headers.push(new Headers(init?.headers));
		return response;
	};
	return { fetch: fetchImpl, headers };
}

const json = (body: unknown, init: ResponseInit = {}) =>
	new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, ...init });

describe('fetchJson', () => {
	it('identifies itself on every call and lets a caller header win', async () => {
		const plain = answering(json({ ok: true }));
		await fetchJson({ url: 'https://registry.example/', signal: new AbortController().signal, fetch: plain.fetch });
		expect(plain.headers[0]?.get('user-agent')).toBe(SOURCE_USER_AGENT);
		expect(plain.headers[0]?.get('accept')).toBe('application/json');

		const overridden = answering(json({ ok: true }));
		await fetchJson({
			url: 'https://registry.example/',
			headers: { 'user-agent': 'other/1', accept: 'application/rdap+json' },
			signal: new AbortController().signal,
			fetch: overridden.fetch,
		});
		expect(overridden.headers[0]?.get('user-agent')).toBe('other/1');
		expect(overridden.headers[0]?.get('accept')).toBe('application/rdap+json');
	});

	it('maps 429 to rate_limited with the Retry-After seconds', async () => {
		const { fetch } = answering(new Response(null, { status: 429, headers: { 'retry-after': '17' } }));
		await expect(
			fetchJson({ url: 'https://registry.example/', signal: new AbortController().signal, fetch }),
		).rejects.toMatchObject({ kind: 'rate_limited', retryAfterSeconds: 17 } satisfies Partial<NameSourceError>);
	});

	it('hands a passed status back as a null body instead of throwing', async () => {
		const { fetch } = answering(new Response(null, { status: 404 }));
		await expect(
			fetchJson({ url: 'https://registry.example/', pass: [404], signal: new AbortController().signal, fetch }),
		).resolves.toEqual({ status: 404, body: null });
	});
});
