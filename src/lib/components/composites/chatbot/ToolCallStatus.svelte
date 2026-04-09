<script lang="ts">
interface Props {
	toolName: string;
	state: 'call' | 'partial-call' | 'result';
	output?: unknown;
}

let { toolName, state, output }: Props = $props();

const TOOL_LABELS: Record<string, string> = {
	desk_list_files: 'Listing files',
	desk_read_file: 'Reading file',
	desk_search_files: 'Searching files',
	desk_update_cells: 'Updating cells',
	desk_rename_file: 'Renaming file',
	desk_create_spreadsheet: 'Creating spreadsheet',
	desk_create_markdown: 'Creating document',
	desk_delete_file: 'Deleting file',
};

const label = $derived(TOOL_LABELS[toolName] ?? toolName);
const hasError = $derived(state === 'result' && output != null && typeof output === 'object' && 'error' in output);
</script>

<div class="tool-status">
	{#if state === 'call' || state === 'partial-call'}
		<span class="i-lucide-loader-2 tool-icon tool-spin"></span>
		<span class="tool-label">{label}...</span>
	{:else if hasError}
		<span class="i-lucide-alert-circle tool-icon tool-error"></span>
		<span class="tool-label tool-error">{label} failed</span>
	{:else}
		<span class="i-lucide-check-circle tool-icon tool-success"></span>
		<span class="tool-label">{label}</span>
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
		color: var(--color-error-fg, #ef4444);
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
