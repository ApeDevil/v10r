<script lang="ts">
	import type { SpreadsheetState } from './spreadsheet.state.svelte';

	interface Props {
		sheet: SpreadsheetState;
	}

	let { sheet }: Props = $props();

	function handleFormulaKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			sheet.commitEdit();
		} else if (event.key === 'Escape') {
			sheet.cancelEdit();
		}
	}

	function handleFormulaInput(event: Event) {
		const target = event.target as HTMLInputElement;
		sheet.editValue = target.value;
		if (!sheet.editing) {
			sheet.startEditing();
		}
	}
</script>

<div class="sheet-formula-bar">
	<span class="sheet-cell-ref">{sheet.activeCellLabel || '—'}</span>
	<span class="sheet-fx">fx</span>
	<input
		type="text"
		class="sheet-formula-input"
		value={sheet.editing ? sheet.editValue : sheet.activeCellRaw}
		disabled={!sheet.activeCell}
		oninput={handleFormulaInput}
		onkeydown={handleFormulaKeydown}
		onfocus={() => { if (!sheet.editing) sheet.startEditing(); }}
	/>
</div>

<style>
	.sheet-formula-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px;
		border-bottom: 1px solid var(--color-border);
		background: var(--surface-1);
		font-size: 12px;
	}

	.sheet-cell-ref {
		padding: 2px 8px;
		min-width: 40px;
		text-align: center;
		font-weight: 600;
		font-size: 11px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		color: var(--color-fg);
	}

	.sheet-fx {
		font-style: italic;
		font-weight: 600;
		color: var(--color-muted);
		font-size: 11px;
	}

	.sheet-formula-input {
		flex: 1;
		padding: 2px 8px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		color: var(--color-fg);
		font-family: monospace;
		font-size: 12px;
	}

	.sheet-formula-input:disabled {
		opacity: 0.5;
	}
</style>
