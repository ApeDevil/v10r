import { describe, expect, it, vi } from 'vitest';
import { getManifest } from './manifest';
import { docsMarkdown } from './markdown.hook';
import { markdownHrefFor } from './markdown-urls';

/** Drive the Handle directly — the hook only reads request.method, url.pathname,
 *  request.headers, and isDataRequest, so a three-field event stub is the honest
 *  surface. */
async function run(path: string, init: RequestInit & { resolveWith?: Response; isDataRequest?: boolean } = {}) {
	const url = new URL(`https://www.v10r.dev${path}`);
	const resolveWith = init.resolveWith ?? new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } });
	const resolve = vi.fn(async () => resolveWith);
	const event = { request: new Request(url, init), url, isDataRequest: init.isDataRequest ?? false } as never;
	const response = await docsMarkdown({ event, resolve } as never);
	return { response, resolve };
}

describe('docsMarkdown', () => {
	it('serves published markdown for every section with the contract headers', async () => {
		const manifest = getManifest();
		for (const section of ['foundation', 'blueprint', 'stack'] as const) {
			const href = markdownHrefFor(manifest[section][0]);
			const { response, resolve } = await run(href);
			expect(response.status, href).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
			expect(response.headers.get('Cache-Control')).toBe('public, max-age=0, s-maxage=3600');
			expect(response.headers.get('Link')).toContain('rel="llms-txt"');
			expect(await response.text()).toMatch(/^# /m);
			expect(resolve).not.toHaveBeenCalled();
		}
	});

	it('serves the root architecture docs', async () => {
		const { response } = await run('/docs/system-abstraction.md');
		expect(response.status).toBe(200);
		expect(await response.text()).toContain('# System Abstraction');
		// Two variants live at the .md URL (agent markdown vs browser fall-through);
		// without Vary a shared cache would serve the markdown 200 to browsers too.
		expect(response.headers.get('Vary')).toBe('Sec-Fetch-Dest');
	});

	it('passes browser document navigations through to routing', async () => {
		// The docs +layout.server.ts then 303s the `.md` suffix away, so a human
		// typing the .md URL lands on the rendered page, never on plain text.
		const { resolve } = await run('/docs/system-abstraction.md', {
			headers: { 'sec-fetch-dest': 'document' },
		});
		expect(resolve).toHaveBeenCalledOnce();
	});

	it('passes SvelteKit data requests through instead of feeding markdown to the client router', async () => {
		// isDataRequest = the client router navigating to a .md link; a markdown
		// body here crashes its JSON.parse and the click silently does nothing.
		const { resolve } = await run('/docs/system-abstraction.md', { isDataRequest: true });
		expect(resolve).toHaveBeenCalledOnce();
	});

	it('404s blocked docs without ever resolving downstream', async () => {
		for (const path of ['/docs/guides/emojis.md', '/docs/blueprint/README.md', '/docs/blueprint/blog.md']) {
			const { response, resolve } = await run(path);
			expect(response.status, path).toBe(404);
			expect(resolve).not.toHaveBeenCalled();
		}
	});

	it('303s a clean URL only on an explicit markdown preference', async () => {
		const entry = getManifest().stack[0];
		const clean = `/docs/${entry.section}/${entry.slug}`;
		const { response, resolve } = await run(clean, { headers: { accept: 'text/markdown' } });
		expect(response.status).toBe(303);
		expect(response.headers.get('Location')).toBe(`${clean}.md`);
		expect(response.headers.get('Vary')).toBe('Accept');
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(resolve).not.toHaveBeenCalled();
	});

	it('passes a browser request through and advertises both Link relations', async () => {
		const entry = getManifest().foundation[0];
		const clean = `/docs/${entry.section}/${entry.slug}`;
		const { response, resolve } = await run(clean, {
			headers: { accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
		});
		expect(resolve).toHaveBeenCalledOnce();
		const link = response.headers.get('Link') ?? '';
		expect(link).toContain(`<${clean}.md>; rel="alternate"; type="text/markdown"`);
		expect(link).toContain('rel="llms-txt"');
	});

	it('308s locale-prefixed markdown URLs to the canonical one', async () => {
		const { response } = await run('/de/docs/stack/bun.md');
		expect(response.status).toBe(308);
		expect(response.headers.get('Location')).toBe('/docs/stack/bun.md');
	});

	it('never negotiates hub pages (no markdown variant exists)', async () => {
		const { response, resolve } = await run('/docs/stack', { headers: { accept: 'text/markdown' } });
		expect(resolve).toHaveBeenCalledOnce();
		expect(response.status).toBe(200);
	});

	it('leaves non-GET and non-docs traffic untouched', async () => {
		const post = await run('/docs/stack/bun.md', { method: 'POST' });
		expect(post.resolve).toHaveBeenCalledOnce();
		const other = await run('/blog', { headers: { accept: 'text/markdown' } });
		expect(other.resolve).toHaveBeenCalledOnce();
	});

	it('HEAD carries the contract headers with no body', async () => {
		const { response } = await run('/docs/system-abstraction.md', { method: 'HEAD' });
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
		expect(await response.text()).toBe('');
	});
});
