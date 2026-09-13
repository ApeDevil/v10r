/**
 * catalog — the project's quick-search catalog (pages, showcases, doc sections, blog posts)
 * as the ONLY authoritative source of project paths.
 *
 * A compact, path-free `<catalog-map>` orients the model on every turn so it knows the
 * catalog exists and when to reach for `search_catalog`; the tool returns exact canonical
 * paths. After the answer, the capability verifies every project path it names: a row a
 * tool (or the navigation lane) surfaced this turn is `cited`; a path nothing surfaced is
 * recorded as exactly that — the answer's claim, not the turn's.
 */
import type { SearchResult } from '$lib/search/types';
import { buildSearchIndex, formatCatalogMap } from '$lib/server/search';
import type { GroundingSourceId } from '$lib/types/assistant-profile';
import type { CitationRecord, GroundingItem, GroundingSource } from '$lib/types/turn-trace';
import { verifyCatalogCitations } from '../catalog-citations';
import { type AssistantCapability, catalogSink } from '../profile/profile';
import { createSearchCatalogTool } from '../tools/search-catalog';

/** A catalog row as a grounding item: the row is its own body, the path is what a citation names. */
export function catalogGroundingItem(row: SearchResult, rank: number, state: GroundingItem['state']): GroundingItem {
	return {
		id: row.id,
		kind: 'catalog',
		title: row.title,
		score: row.score,
		rank,
		state,
		path: row.path,
		catalog: {
			surface: row.surface,
			anchor: row.anchor,
			breadcrumb: row.breadcrumb,
			icon: row.icon,
			badge: row.badge,
			locale: row.locale,
		},
	};
}

export const catalog: AssistantCapability = {
	id: 'catalog',
	when: 'always — the map orients every turn; the tool mounts when tools are',
	guidance: `Project catalog rules:
1. To find WHERE a page, component/showcase, doc, or blog post lives — or to give the user a link — call \`search_catalog\`. It returns exact canonical paths.
2. Emit a path or link ONLY if it appears verbatim in a catalog, docs or pattern tool result from THIS turn, or in a <catalog-results> block. NEVER invent or guess a path.
3. If \`search_catalog\` returns nothing for what the user asked, say it isn't in the catalog — do not fabricate a plausible URL.
4. Use \`search_catalog\` for navigation / "what exists"; use the retrieved documentation for explaining how something works.`,
	sources: ['catalog'],
	activates: () => ({ active: true }),
	// The map is static per locale — the same for every user, so it sits in the stable prefix.
	grounding: async (turn) => ({
		blocks: [{ id: 'catalog-map', section: 'grounding', text: formatCatalogMap(turn.locale), stable: true }],
	}),
	tools: (turn, state) => createSearchCatalogTool(turn.locale, turn.authCeiling, catalogSink(state, 'catalog')),
	// The rows the tools surfaced join the grounding as executed items, each naming the tool
	// call that returned it (the navigation lane's own rows are already recorded as included,
	// so the skip below never reaches them); the paths the answer names become citations; any
	// project path the model emitted that nothing surfaced is recorded as exactly that.
	verify: async (answer, turn, state) => {
		const citations: CitationRecord[] = [];
		const updated = new Map<GroundingSourceId, GroundingSource>();
		for (const { row, source, toolCallId } of state.surfacedCatalog.values()) {
			const existing = updated.get(source) ?? state.grounding.get(source);
			if (existing?.items.some((item) => item.id === row.id)) continue;
			const items = existing?.items ?? [];
			updated.set(source, {
				...(existing ?? { id: source }),
				ran: true,
				items: [
					...items,
					{ ...catalogGroundingItem(row, items.length, 'executed'), ...(toolCallId ? { toolCallId } : {}) },
				],
			});
		}
		for (const { row, source } of state.surfacedCatalog.values()) {
			if (answer.includes(row.path)) citations.push({ itemId: row.id, source, match: 'path', path: row.path });
		}
		const surfacedPaths = new Set(Array.from(state.surfacedCatalog.values(), ({ row }) => row.path));
		const knownPaths = new Set(buildSearchIndex(turn.locale).map((r) => r.path));
		for (const verdict of verifyCatalogCitations(answer, surfacedPaths, knownPaths).verdicts) {
			if (verdict.status === 'exists') continue;
			citations.push({
				itemId: verdict.path,
				source: 'catalog',
				match: 'unsurfaced',
				path: verdict.path,
				known: verdict.status === 'drifted',
			});
		}
		return { citations, grounding: [...updated.values()] };
	},
};
