import { redirect } from '@sveltejs/kit';

// The `.md` layer serves raw markdown to agents only — browser document
// navigations and client-router data requests fall through the docsMarkdown
// hook into routing (see markdown-hook.ts). Any docs route reached with a
// `.md`-suffixed path is such a fall-through: send it to the rendered page.
export const load = async ({ url }) => {
	if (url.pathname.endsWith('.md')) {
		redirect(303, url.pathname.slice(0, -'.md'.length));
	}
};
