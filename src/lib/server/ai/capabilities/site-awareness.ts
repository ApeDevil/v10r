/**
 * site-awareness — the chatbot knows which public page the question was asked from.
 *
 * Passive by default: when the route resolved, a `<current-page>` block names the page so
 * "this"/"here" can bind to it — soft by framing, it cannot scope-trap an off-topic
 * question. The capability *activates* only on deixis ("how does this work?"), when the
 * docs query is seeded with the page so retrieval finds THIS page's docs; if that found
 * nothing, the abstention guide says so rather than leaving it to the model's
 * self-knowledge. The content is server-resolved (catalog) and XML-escaped; the client
 * string never reaches the prompt. See `docs/blueprint/ai/site-awareness.md`.
 */
import type { PageContext } from '$lib/server/search';
import { escapeXmlAttr } from '$lib/utils/xml';
import type { AssistantCapability } from '../profile/profile';

/**
 * Deixis gate: does this message point AT the current page ("this", "here", "how does
 * this work", "explain this", "this feature/component/showcase")? Only then is the
 * (already-paid) retrieval embed spent on a page-seeded query — keeping the page out of
 * the 90% of questions that name their own topic. Deterministic; tune the anchors freely.
 */
export function referencesCurrentPage(text: string): boolean {
	return /\b(this|current)\s+(page|feature|component|showcase|section|demo|example|thing)\b|how (?:does|do) (?:this|it|these)\b|what(?:'s| is| are) (?:this|these|here)\b|explain (?:this|it|the page)\b|on this page\b|\bright here\b/i.test(
		text,
	);
}

/**
 * The docs query for a deictic question: the bare message embeds to noise, so the resolved
 * page title/breadcrumb seed it. Server-authored text only — the embed query never carries
 * the client's route string.
 */
export function pageSeededQuery(page: PageContext, text: string): string {
	return `${page.title}. ${page.breadcrumb.join(' ')}. ${text}`;
}

export function formatCurrentPageBlock(page: {
	path: string;
	title: string;
	breadcrumb: string[];
	surface: string;
}): string {
	const trail = page.breadcrumb.length ? ` (${page.breadcrumb.join(' › ')})` : '';
	return [
		`<current-page route="${escapeXmlAttr(page.path)}" kind="${escapeXmlAttr(page.surface)}">`,
		`The user is currently viewing: ${escapeXmlAttr(page.title + trail)}.`,
		`Treat this only as the referent of "this", "here", or "this page". The user's explicit topic always wins over the current page.`,
		`</current-page>`,
	].join('\n');
}

export const siteAwareness: AssistantCapability = {
	id: 'site-awareness',
	when: 'the question points at the current page ("this page", "how does this work")',
	activates: (turn) => {
		if (!turn.pageContext) return { active: false, reason: 'no_page' };
		return referencesCurrentPage(turn.userMsgText) ? { active: true } : { active: false, reason: 'no_deixis' };
	},
	awareness: (turn) =>
		turn.pageContext
			? [{ id: 'current-page', section: 'awareness', text: formatCurrentPageBlock(turn.pageContext), stable: false }]
			: [],
	// Honest abstention: the user pointed at a page we retrieved no docs for.
	guide: (turn, state) =>
		turn.pageContext && state.activations.get('site-awareness')?.active && !state.hasBlock('retrieval-context')
			? {
					id: 'page-abstention',
					section: 'guide',
					text: `No page-specific documentation was retrieved for "${turn.pageContext.title}". Do not fabricate specifics about this page; if the user is asking about it, say plainly you don't have page-specific docs for it, then offer general project knowledge or where to look.`,
					stable: false,
				}
			: null,
};
