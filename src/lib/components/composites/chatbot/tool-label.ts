/**
 * The one human label of a tool: the status row's verb ("Searching the catalog"), read
 * from the i18n message the manifest's `toolLabelKey` names. The chatbot and the desk
 * once kept two hand-written tables (one localized, one not); this is the only lookup,
 * and `tool-label.gate.test.ts` proves it covers every manifest tool in every locale.
 *
 * The map references each message function by name on purpose: a dynamic
 * `messages[toolLabelKey(name)]` lookup on the Paraglide namespace defeats tree-shaking
 * and ships every message of every locale into each route that renders a tool row
 * (+240 KB gzipped on `/desk` when it was written that way).
 */
import * as m from '$lib/paraglide/messages';

const TOOL_LABELS: Record<string, () => string> = {
	search_catalog: m.ai_tool_search_catalog,
	search_project_docs: m.ai_tool_search_project_docs,
	search_pattern_library: m.ai_tool_search_pattern_library,
	desk_list_files: m.ai_tool_desk_list_files,
	desk_read_file: m.ai_tool_desk_read_file,
	desk_file_tree: m.ai_tool_desk_file_tree,
	desk_search_files: m.ai_tool_desk_search_files,
	desk_get_open_panels: m.ai_tool_desk_get_open_panels,
	desk_update_cells: m.ai_tool_desk_update_cells,
	desk_rename_file: m.ai_tool_desk_rename_file,
	desk_update_markdown: m.ai_tool_desk_update_markdown,
	desk_edit_markdown: m.ai_tool_desk_edit_markdown,
	desk_create_spreadsheet: m.ai_tool_desk_create_spreadsheet,
	desk_create_markdown: m.ai_tool_desk_create_markdown,
	desk_delete_file: m.ai_tool_desk_delete_file,
	desk_search_knowledge: m.ai_tool_desk_search_knowledge,
	desk_propose_plan: m.ai_tool_desk_propose_plan,
};

/** The tool names the map labels — the gate test pins them to the manifest. */
export const LABELED_TOOLS: readonly string[] = Object.keys(TOOL_LABELS);

/** The tool's localized label, or its name when it is not a manifest tool (`resolve_ref`). */
export function toolLabel(toolName: string): string {
	return TOOL_LABELS[toolName]?.() ?? toolName;
}
