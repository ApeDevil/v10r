<script lang="ts">
/**
 * One row per tool call the assistant makes — what it is doing while the user waits, and
 * whether it worked. `phase` is the UI vocabulary; the mapping from the SDK's tool-part
 * `state` lives in ChatMessage.
 */
interface Props {
	toolName: string;
	/** Not named `state` — that collides with the `$state` rune. */
	phase: 'pending' | 'running' | 'done' | 'error';
	/** The tool's output; a `done` call whose output carries an `error` envelope failed too. */
	output?: unknown;
	/** Display label for the tool (the chatbot passes its localized names); falls back to the desk table, then the name. */
	label?: string;
}

let { toolName, phase, output, label }: Props = $props();

const TOOL_LABELS: Record<string, string> = {
	desk_list_files: 'Listing files',
	desk_read_file: 'Reading file',
	desk_search_files: 'Searching files',
	desk_file_tree: 'Reading file tree',
	desk_get_open_panels: 'Checking open panels',
	desk_search_knowledge: 'Searching pinned files',
	desk_update_cells: 'Updating cells',
	desk_update_markdown: 'Rewriting document',
	desk_edit_markdown: 'Editing document',
	desk_rename_file: 'Renaming file',
	desk_create_spreadsheet: 'Creating spreadsheet',
	desk_create_markdown: 'Creating document',
	desk_delete_file: 'Deleting file',
	desk_propose_plan: 'Proposing a plan',
};

const text = $derived(label ?? TOOL_LABELS[toolName] ?? toolName);
const failed = $derived(
	phase === 'error' || (phase === 'done' && output != null && typeof output === 'object' && 'error' in output),
);
</script>

<div class="tool-status">
	{#if phase === 'pending' || phase === 'running'}
		<span class="i-lucide-loader-2 tool-icon tool-spin"></span>
		<span class="tool-label">{text}...</span>
	{:else if failed}
		<span class="i-lucide-alert-circle tool-icon tool-error"></span>
		<span class="tool-label tool-error">{text} failed</span>
	{:else}
		<span class="i-lucide-check-circle tool-icon tool-success"></span>
		<span class="tool-label">{text}</span>
	{/if}
</div>

<style>
	.tool-status {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		border-radius: var(--radius-sm, 4px);
		background: color-mix(in srgb, var(--color-muted) 8%, transparent);
		font-size: 12px;
	}

	.tool-icon {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	.tool-spin {
		color: var(--color-muted);
		animation: spin 1s linear infinite;
	}

	.tool-error {
		color: var(--color-error-fg);
	}

	.tool-success {
		color: var(--color-primary);
	}

	.tool-label {
		color: var(--color-muted);
		font-style: italic;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
</style>
