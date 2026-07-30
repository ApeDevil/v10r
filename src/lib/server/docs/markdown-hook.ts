import type { Handle } from '@sveltejs/kit';
import { prefersMarkdown } from './accept';
import { markdownBodyFor, resolveMarkdownRequest, toMarkdownPath } from './markdown-urls';

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
 * Negotiation semantics (cache-safety, not convenience): the two cacheable
 * artifacts — HTML at the clean URL, markdown at the `.md` URL — each live at
 * exactly one URL with no Vary. Only the negotiated redirect varies by request
 * header, so it is 303 + `Vary: Accept` + `no-store`: nothing a shared cache
 * could poison. A 308 here would durably bind the clean URL to the redirect.
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

	if (pathname.endsWith('.md')) {
		const target = resolveMarkdownRequest(pathname);
		const body = target ? markdownBodyFor(target) : null;
		if (body === null) {
			return new Response(method === 'HEAD' ? null : 'Not found.\n', {
				status: 404,
				headers: {
					'Content-Type': 'text/plain; charset=utf-8',
					'Cache-Control': 'public, max-age=0, s-maxage=60',
				},
			});
		}
		return new Response(method === 'HEAD' ? null : body, {
			headers: {
				'Content-Type': 'text/markdown; charset=utf-8',
				'Cache-Control': MARKDOWN_CACHE_CONTROL,
				Link: `<${pathname.slice(0, -3)}>; rel="canonical", ${LLMS_TXT_LINK}`,
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
