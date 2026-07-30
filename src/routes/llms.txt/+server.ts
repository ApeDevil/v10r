import { buildLlmsTxt } from '$lib/server/docs/llms-txt';
import { getManifest } from '$lib/server/docs/manifest';
import type { RequestHandler } from './$types';

/**
 * /llms.txt — the agent-facing URL map (llmstxt.org). Built per-request from the
 * published docs manifest (already in memory — the corpus is inlined at build
 * time), so it can never drift from /docs. Advertised via the `Link` header the
 * docsMarkdown hook stamps on every /docs response, and in robots.txt.
 */
export const GET: RequestHandler = () => {
	return new Response(buildLlmsTxt(getManifest()), {
		headers: {
			// text/plain like robots.txt: renders readably in a browser tab.
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=0, s-maxage=3600',
		},
	});
};
