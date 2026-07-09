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
