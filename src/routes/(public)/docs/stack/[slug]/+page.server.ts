import { error } from '@sveltejs/kit';
import { docsSourceUrl, renderDoc } from '$lib/server/docs/loader';

export const load = async ({ params }) => {
	const rendered = await renderDoc('stack', params.slug);
	if (!rendered) throw error(404, 'Doc not found');
	return {
		title: `${rendered.entry.title} — Docs`,
		entry: rendered.entry,
		html: rendered.html,
		toc: rendered.toc,
		sourceUrl: docsSourceUrl(rendered.entry.sourcePath),
	};
};
