// Moved 2026-08-13 (AI-surfaces showcase refactor). This URL is published in
// mcp/patterns.registry.json to external MCP consumers, so stale copies keep
// resolving via this 308. Not a compat shim — remove after 2026-11.
import { redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/i18n';

export const load = () => {
	redirect(308, localizeHref('/showcases/ai/chatbot'));
};
