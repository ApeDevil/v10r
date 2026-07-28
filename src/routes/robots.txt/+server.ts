import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const SITEMAP_URL = 'https://www.v10r.dev/sitemap.xml';

export const GET: RequestHandler = async () => {
	const vercelEnv = env.VERCEL_ENV ?? 'development';

	let body: string;

	if (vercelEnv === 'production') {
		body = [
			'User-agent: *',
			'Allow: /',
			'Disallow: /api/',
			'Disallow: /account/',
			'Disallow: /de/app/',
			'Disallow: /ru/app/',
			'',
			// The Impressum is deliberately NOT disallowed for general crawlers.
			// It serves `X-Robots-Tag: noindex` — and a crawler that is blocked from
			// fetching never sees the noindex, which is how a bare URL still ends up
			// in an index via a backlink. Let them read it, then obey the noindex.
			'',
			// AI / LLM crawlers — scoped block, not a sitewide one.
			//
			// v10r is a pattern library that WANTS to be read by agents; the public
			// MCP endpoint exists for exactly that. So these agents keep full access
			// to the patterns, docs and showcases. What they do not get is the
			// Impressum, which carries a private postal address that has no business
			// in a training corpus or a scraped lead list. `Disallow` (not noindex)
			// because it stops the fetch itself — the only thing that keeps the
			// address out of a corpus is never sending it.
			//
			// Note: Google-Extended governs Gemini training only. It has no effect on
			// Google Search ranking or indexing, so it costs nothing to set.
			'User-agent: GPTBot',
			'User-agent: OAI-SearchBot',
			'User-agent: ChatGPT-User',
			'User-agent: ClaudeBot',
			'User-agent: anthropic-ai',
			'User-agent: Claude-Web',
			'User-agent: CCBot',
			'User-agent: Google-Extended',
			'User-agent: PerplexityBot',
			'User-agent: Bytespider',
			'User-agent: Amazonbot',
			'User-agent: Applebot-Extended',
			'User-agent: Meta-ExternalAgent',
			'User-agent: FacebookBot',
			'User-agent: cohere-ai',
			'User-agent: Diffbot',
			'User-agent: ImagesiftBot',
			'User-agent: Timpibot',
			'User-agent: Omgilibot',
			// A named group REPLACES the `*` group for that agent, so the base
			// disallows have to be repeated here or these agents would gain access
			// to everything `*` is kept out of.
			'Disallow: /api/',
			'Disallow: /account/',
			'Disallow: /de/app/',
			'Disallow: /ru/app/',
			'Disallow: /impressum',
			'Disallow: /de/impressum',
			'Disallow: /ru/impressum',
			'',
			`Sitemap: ${SITEMAP_URL}`,
			'',
		].join('\n');
	} else {
		// preview & development — block all crawlers
		body = ['User-agent: *', 'Disallow: /', ''].join('\n');
	}

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain',
		},
	});
};
