import { allToolMeta, chatbotToolMeta, type DeskToolMeta } from '$lib/server/ai/tools';
import { requireAdmin } from '$lib/server/auth/guards';
import type { PageServerLoad } from './$types';

/**
 * Tool topology — derived at load time from the SAME per-surface tool-meta registries
 * the orchestrator imports (single source of truth; the table can't drift from the real
 * tool set). BRANCH is membership in `chatbotToolMeta` (retrieval) vs `deskbotToolMeta`
 * (desk); only desk tools carry a `scope`.
 */

const NOTES: Record<string, string> = {
	get_llmwiki_pages: 'Expand wiki pages beyond the TLDR.',
	get_rawrag_chunks: 'Drill to raw source chunks — verbatim-id rule, max 3/turn.',
	search_catalog: 'Search the ⌘K catalog → canonical paths (CitationChip).',
	search_project_docs: 'Semantic search over the system-owned docs corpus.',
	desk_list_files: 'List files in the desk workspace.',
	desk_read_file: 'Read a desk file.',
	desk_file_tree: 'Desk file tree.',
	desk_search_files: 'Search desk file contents.',
	desk_get_open_panels: 'Inspect currently open desk panels.',
	desk_rename_file: 'Rename a desk file.',
	desk_update_markdown: 'Edit a markdown document.',
	desk_update_cells: 'Edit spreadsheet cells.',
	desk_create_markdown: 'Create a markdown document.',
	desk_create_spreadsheet: 'Create a spreadsheet.',
	desk_delete_file: 'Delete a desk file.',
	desk_propose_plan: 'Plan-before-execute (governor-gated when a mutating scope is on).',
};

const RISK_ORDER: Record<string, number> = { read: 0, create: 1, write: 2, destructive: 3 };

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);

	const tools = Object.entries(allToolMeta).map(([name, meta]) => {
		const branch: 'retrieval' | 'desk' = name in chatbotToolMeta ? 'retrieval' : 'desk';
		const scope = (meta as Partial<DeskToolMeta>).scope;
		const mutating = branch === 'desk' && scope !== 'desk:read';
		return {
			name,
			branch,
			risk: meta.risk,
			scope: scope ?? null,
			scopeLabel: branch === 'retrieval' ? 'always-on' : (scope ?? ''),
			stepBudget: branch === 'retrieval' ? 3 : mutating ? 5 : 3,
			note: NOTES[name] ?? '',
		};
	});

	tools.sort((a, b) => {
		if (a.branch !== b.branch) return a.branch === 'retrieval' ? -1 : 1;
		return (RISK_ORDER[a.risk] ?? 9) - (RISK_ORDER[b.risk] ?? 9) || a.name.localeCompare(b.name);
	});

	return { title: 'Tools', tools };
};
