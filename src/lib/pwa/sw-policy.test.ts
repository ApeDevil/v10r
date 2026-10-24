import { describe, expect, it } from 'vitest';
import { isImmutableAsset, manifestPathname, mayCache, offlineShellAssets, shouldHandle } from './sw-policy';

const ORIGIN = 'https://www.v10r.dev';

describe('shouldHandle', () => {
	it('handles plain same-origin GET pages', () => {
		expect(shouldHandle(new Request(`${ORIGIN}/showcases`))).toBe(true);
	});

	it('refuses every non-GET method', () => {
		for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
			expect(shouldHandle(new Request(`${ORIGIN}/anything`, { method }))).toBe(false);
		}
	});

	it('refuses all /api/ paths (REST, auth, cron, SSE endpoints)', () => {
		expect(shouldHandle(new Request(`${ORIGIN}/api/notifications/stream`))).toBe(false);
		expect(shouldHandle(new Request(`${ORIGIN}/api/auth/callback/google`))).toBe(false);
		expect(shouldHandle(new Request(`${ORIGIN}/api/account`))).toBe(false);
	});

	it('refuses SSE requests by accept header even off /api/', () => {
		const req = new Request(`${ORIGIN}/some/stream`, {
			headers: { accept: 'text/event-stream' },
		});
		expect(shouldHandle(req)).toBe(false);
	});
});

describe('isImmutableAsset', () => {
	it('accepts hashed build assets', () => {
		expect(isImmutableAsset(new URL(`${ORIGIN}/_app/immutable/chunks/abc123.js`))).toBe(true);
	});

	it('refuses immutable-looking URLs carrying a query string (cache-deception guard)', () => {
		expect(isImmutableAsset(new URL(`${ORIGIN}/_app/immutable/chunks/abc123.js?__pathname=/api/account`))).toBe(false);
	});

	it('refuses non-immutable paths, including admin and data requests', () => {
		expect(isImmutableAsset(new URL(`${ORIGIN}/admin/audit`))).toBe(false);
		expect(isImmutableAsset(new URL(`${ORIGIN}/showcases/__data.json`))).toBe(false);
	});
});

describe('mayCache', () => {
	// Constructed Responses report type 'default'; real same-origin fetch
	// responses are 'basic' — model that so the fixture matches reality.
	const ok = (headers: Record<string, string> = {}, type = 'basic') => {
		const response = new Response('x', { status: 200, headers });
		Object.defineProperty(response, 'type', { value: type });
		return response;
	};

	it('accepts a clean same-origin (basic) 200', () => {
		expect(mayCache(ok())).toBe(true);
	});

	it('refuses anything that is not a basic response (opaque, synthetic)', () => {
		expect(mayCache(ok({}, 'opaque'))).toBe(false);
		expect(mayCache(new Response('x', { status: 200 }))).toBe(false); // type 'default'
	});

	it('refuses non-2xx and error responses', () => {
		expect(mayCache(new Response('x', { status: 404 }))).toBe(false);
		expect(mayCache(new Response('x', { status: 500 }))).toBe(false);
	});

	it('refuses no-store / private responses (the authed-response stamp)', () => {
		expect(mayCache(ok({ 'cache-control': 'no-store, private' }))).toBe(false);
		expect(mayCache(ok({ 'cache-control': 'private, max-age=3600' }))).toBe(false);
	});

	it('refuses responses that set cookies', () => {
		expect(mayCache(ok({ 'set-cookie': 'session=abc' }))).toBe(false);
	});
});

describe('offlineShellAssets', () => {
	const build = [
		'/_app/immutable/entry/start.abc.js',
		'/_app/immutable/nodes/0.def.js',
		'/_app/immutable/assets/0.ghi.css',
		'/_app/immutable/chunks/three.jkl.js',
	];

	it('returns the hashed assets the offline page references, relative or absolute', () => {
		const html = `<link href="./_app/immutable/assets/0.ghi.css" rel="stylesheet">
			<link rel="modulepreload" href="/_app/immutable/nodes/0.def.js">
			<script>import("../_app/immutable/entry/start.abc.js")</script>`;
		expect(offlineShellAssets(html, build).sort()).toEqual([
			'/_app/immutable/assets/0.ghi.css',
			'/_app/immutable/entry/start.abc.js',
			'/_app/immutable/nodes/0.def.js',
		]);
	});

	it('leaves out build files the page does not load', () => {
		const html = '<link rel="modulepreload" href="./_app/immutable/nodes/0.def.js">';
		expect(offlineShellAssets(html, build)).not.toContain('/_app/immutable/chunks/three.jkl.js');
	});

	it('ignores references that are not in the build, and duplicates', () => {
		const html = `"./_app/immutable/chunks/evil.js" "./_app/immutable/nodes/0.def.js" "./_app/immutable/nodes/0.def.js"`;
		expect(offlineShellAssets(html, build)).toEqual(['/_app/immutable/nodes/0.def.js']);
	});
});

describe('manifestPathname', () => {
	it('turns base-relative manifest paths into the pathnames requests carry', () => {
		const worker = `${ORIGIN}/service-worker.js`;
		expect(manifestPathname('_app/immutable/entry/start.abc.js', worker)).toBe('/_app/immutable/entry/start.abc.js');
		expect(manifestPathname('icons/icon-192.png', worker)).toBe('/icons/icon-192.png');
		expect(manifestPathname('offline', worker)).toBe('/offline');
	});

	it('keeps a base path, which the worker is served under', () => {
		expect(manifestPathname('offline', `${ORIGIN}/base/service-worker.js`)).toBe('/base/offline');
	});

	it('feeds offlineShellAssets the shape its allowlist expects', () => {
		const immutable = ['_app/immutable/nodes/0.def.js'].map((path) =>
			manifestPathname(path, `${ORIGIN}/service-worker.js`),
		);
		expect(offlineShellAssets(`"./_app/immutable/nodes/0.def.js"`, immutable)).toEqual([
			'/_app/immutable/nodes/0.def.js',
		]);
	});
});
