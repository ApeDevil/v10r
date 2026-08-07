import { error } from '@sveltejs/kit';
import { docsSourceUrl, renderRootDoc } from '$lib/server/docs/loader';

// Serves the repo-root entry-point docs (ROOT_DOCS: system-abstraction,
// codebase-organization) as rendered pages — they live outside the manifest,
// so the section routes can't reach them. Static section dirs win the route
// match, so this only ever sees the leftover /docs/<slug> shapes.
export const load = async ({ params }) => {
	const rendered = await renderRootDoc(params.slug);
	if (!rendered) throw error(404, 'Doc not found');
	return {
		title: `${rendered.doc.title} — Docs`,
		doc: rendered.doc,
		html: rendered.html,
		toc: rendered.toc,
		sourceUrl: docsSourceUrl(rendered.doc.sourcePath),
	};
};
