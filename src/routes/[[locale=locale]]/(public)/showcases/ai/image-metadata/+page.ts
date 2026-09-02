// Moved 2026-08-13 (AI-surfaces showcase refactor) to /showcases/toolkits/.
// This URL is published in pattern-library/registry.json to external MCP consumers,
// so stale copies keep resolving via this 308. Remove after 2026-11.
import { redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/i18n';

export const load = () => {
	redirect(308, localizeHref('/showcases/toolkits/image-metadata'));
};
