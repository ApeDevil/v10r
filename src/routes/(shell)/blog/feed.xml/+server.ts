import type { RequestHandler } from './$types';
import { listPublishedPostsForFeed } from '$lib/server/blog';

function escapeCdata(s: string): string {
	return s.replace(/]]>/g, ']]]]><![CDATA[>');
}

export const GET: RequestHandler = async ({ url }) => {
	const siteUrl = url.origin;
	const posts = await listPublishedPostsForFeed(20);

	const items = posts
		.map(
			(p) => `
		<item>
			<title><![CDATA[${escapeCdata(p.title)}]]></title>
			<link>${siteUrl}/blog/${encodeURIComponent(p.slug)}</link>
			<guid isPermaLink="true">${siteUrl}/blog/${encodeURIComponent(p.slug)}</guid>
			<description><![CDATA[${escapeCdata(p.summary ?? '')}]]></description>
			<pubDate>${p.publishedAt.toUTCString()}</pubDate>
			${p.authorName ? `<dc:creator><![CDATA[${escapeCdata(p.authorName)}]]></dc:creator>` : ''}
		</item>`,
		)
		.join('');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
	<channel>
		<title>Velociraptor Blog</title>
		<link>${siteUrl}/blog</link>
		<description>Thoughts, tutorials, and updates</description>
		<language>en</language>
		<atom:link href="${siteUrl}/blog/feed.xml" rel="self" type="application/rss+xml"/>
		${items}
	</channel>
</rss>`;

	return new Response(xml.trim(), {
		headers: {
			'Content-Type': 'application/rss+xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600',
		},
	});
};
