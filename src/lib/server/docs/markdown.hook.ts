import type { Handle } from '@sveltejs/kit';
import { prefersMarkdown } from './accept';

/**
 * docsMarkdown — the agent-facing `.md` layer over /docs.
 *
 * Serves every published doc as raw markdown at its URL + `.md`, and honors an
 * explicit `Accept: text/markdown` on the clean URL with a 303 to that variant.
 * A hook rather than routes because blueprint slugs contain slashes (a rest
 * param with a `.md` suffix does not exist in SvelteKit routing).
 *
 * Position in the chain is load-bearing: ABOVE loadStyle and i18n. Both may
 * Set-Cookie, and a Set-Cookie on a markdown response would silently void
 * `s-maxage` on every shared cache; sitting above them also skips the
 * style-cookie parse (and its possible DB lookup) and keeps short-circuited
 * responses out of analyticsCollector. securityHeaders still stamps its set on
 * the way out. Pinned by handle-chain.gate.test.ts.
 *
 * Negotiation semantics (cache-safety, not convenience): HTML at the clean URL
 * is Vary-free. The `.md` URL serves its cacheable markdown only to agents —
 * a browser document navigation (`sec-fetch-dest: document`) and a SvelteKit
 * data request (client-router navigation; the /__data.json suffix is stripped
 * before hooks run, so serving markdown here would crash the router's
 * JSON.parse) both fall through to routing, where the docs layout 303s the
 * `.md` suffix away to the rendered page. The markdown 200/404 therefore carry
 * `Vary: Sec-Fetch-Dest`, and every negotiated redirect is 303 + Vary +
 * `no-store`: nothing a shared cache could poison. A 308 anywhere here would
 * durably bind a URL to one variant.
 */
const MARKDOWN_CACHE_CONTROL = 'public, max-age=0, s-maxage=3600';
const LLMS_TXT_LINK = '</llms.txt>; rel="llms-txt"';

export const docsMarkdown: Handle = async ({ event, resolve }) => {
	const method = event.request.method;
	if (method !== 'GET' && method !== 'HEAD') return resolve(event);
	const { pathname } = event.url;

	// /de/docs/x.md, /ru/docs/x.md → the one canonical markdown URL. Permanent is
	// honest here: markdown carries no locale chrome, so there is exactly one.
	// (/en/… is already stripped by stripBaseLocalePrefix.)
	const localePrefixed = /^\/(?:de|ru)(\/docs\/.+\.md)$/.exec(pathname);
	if (localePrefixed) {
		return new Response(null, { status: 308, headers: { Location: localePrefixed[1] } });
	}

	if (!pathname.startsWith('/docs/')) return resolve(event);

	// Imported here, not at module scope, deliberately. `markdown-urls` pulls the
	// docs manifest, whose `import.meta.glob('/docs/**/*.md', { eager: true })`
	// inlines the WHOLE corpus (~0.5 MB of string literals). As a static import
	// that landed in the boot graph of every serverless cold start — including `/`,
	// `/feedback` and every /api route, none of which can ever read a doc. Docs
	// routes need the corpus anyway (their page load renders from it), so gating it
	// behind this prefix check costs them nothing and takes it off every other path.
	const { markdownBodyFor, resolveMarkdownRequest, toMarkdownPath } = await import('./markdown-urls');

	if (pathname.endsWith('.md')) {
		// Raw markdown is for agents only. Humans (document navigations) and the
		// client router (data requests) go through routing instead, where the docs
		// layout redirects the `.md` suffix away to the rendered page.
		if (event.isDataRequest || event.request.headers.get('sec-fetch-dest') === 'document') {
			return resolve(event);
		}
		const target = resolveMarkdownRequest(pathname);
		const body = target ? markdownBodyFor(target) : null;
		if (body === null) {
			return new Response(method === 'HEAD' ? null : 'Not found.\n', {
				status: 404,
				headers: {
					'Content-Type': 'text/plain; charset=utf-8',
					'Cache-Control': 'public, max-age=0, s-maxage=60',
					Vary: 'Sec-Fetch-Dest',
				},
			});
		}
		return new Response(method === 'HEAD' ? null : body, {
			headers: {
				'Content-Type': 'text/markdown; charset=utf-8',
				'Cache-Control': MARKDOWN_CACHE_CONTROL,
				Link: `<${pathname.slice(0, -3)}>; rel="canonical", ${LLMS_TXT_LINK}`,
				Vary: 'Sec-Fetch-Dest',
			},
		});
	}

	const md = toMarkdownPath(pathname);
	if (md && prefersMarkdown(event.request.headers)) {
		return new Response(null, {
			status: 303,
			headers: { Location: md, Vary: 'Accept', 'Cache-Control': 'no-store' },
		});
	}
	const response = await resolve(event);
	if (md) response.headers.append('Link', `<${md}>; rel="alternate"; type="text/markdown"`);
	response.headers.append('Link', LLMS_TXT_LINK);
	return response;
};
