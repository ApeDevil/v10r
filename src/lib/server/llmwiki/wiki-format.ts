/**
 * Format llmwiki hits + pointers for injection into the chat system prompt.
 *
 * Uses a compact, LLM-friendly TOON-ish layout: each hit is a named block
 * with scalar fields on one line and a pointers table below. We do not
 * depend on an external TOON library yet — the encoding is stable, tested,
 * and can be swapped later once @toon-format/toon is pinned.
 *
 * Shape example:
 *
 *   <llmwiki-hits>
 *   #1 slug: oauth-pkce
 *      title: OAuth PKCE Flow
 *      tldr: PKCE pins a public client to its token request...
 *      tags: [auth, oauth]
 *      coverage: 4 sources, stale=false
 *      pointers:
 *        - chk_01 | doc_abc | "RFC 7636" | w=1.00
 *        - chk_02 | doc_abc | "RFC 7636" | w=0.80
 *   #2 slug: ...
 *   </llmwiki-hits>
 */

import type { LlmwikiHit, LlmwikiPage } from './types';

function escapeOneLine(s: string, max = 200): string {
	const collapsed = s.replace(/\s+/g, ' ').trim();
	return collapsed.length > max ? `${collapsed.slice(0, max - 1)}…` : collapsed;
}

function formatPointer(i: number, p: LlmwikiHit['pointers'][number]): string {
	const title = escapeOneLine(p.documentTitle, 40);
	return `    ${i + 1}. ${p.chunkId} | ${p.documentId} | "${title}" | w=${p.weight.toFixed(2)}`;
}

export function formatHitsForPrompt(hits: LlmwikiHit[]): string {
	if (hits.length === 0) return '';

	const lines: string[] = ['<llmwiki-hits>'];
	for (let i = 0; i < hits.length; i++) {
		const h = hits[i];
		lines.push(`#${i + 1} slug: ${h.slug}`);
		lines.push(`   title: ${escapeOneLine(h.title, 120)}`);
		lines.push(`   tldr: ${escapeOneLine(h.tldr, 400)}`);
		if (h.tags.length > 0) lines.push(`   tags: [${h.tags.join(', ')}]`);
		lines.push(`   coverage: ${h.coverage.sourceCount} sources, stale=${h.coverage.stale}`);
		if (h.pointers.length > 0) {
			lines.push('   pointers:');
			for (const [idx, p] of h.pointers.entries()) {
				lines.push(formatPointer(idx, p));
			}
		}
	}
	lines.push('</llmwiki-hits>');
	return lines.join('\n');
}

export function formatOverviewForPrompt(overview: LlmwikiPage | null): string {
	if (!overview) return '';
	return [
		'<llmwiki-overview>',
		`slug: ${overview.slug}`,
		`title: ${overview.title}`,
		`tldr: ${escapeOneLine(overview.tldr, 400)}`,
		overview.body ? `\n${overview.body}` : '',
		'</llmwiki-overview>',
	]
		.filter(Boolean)
		.join('\n');
}

/** Full prompt block for a chat turn: overview + hits. */
export function formatLlmwikiContext(overview: LlmwikiPage | null, hits: LlmwikiHit[]): string {
	const parts: string[] = [];
	const ov = formatOverviewForPrompt(overview);
	if (ov) parts.push(ov);
	const hs = formatHitsForPrompt(hits);
	if (hs) parts.push(hs);
	return parts.join('\n\n');
}
