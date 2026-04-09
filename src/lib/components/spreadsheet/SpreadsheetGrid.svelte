<script lang="ts">
import type { SpreadsheetState } from './spreadsheet.state.svelte';

interface Props {
	sheet: SpreadsheetState;
}

let { sheet }: Props = $props();

let editInput: HTMLInputElement | undefined = $state();

// Focus edit input when editing starts
$effect(() => {
	if (sheet.editing && editInput) {
		editInput.focus();
	}
});

function handleCellClick(col: number, row: number, event: MouseEvent) {
	sheet.select(col, row, event.shiftKey);
}

function handleCellDblClick(col: number, row: number) {
	sheet.select(col, row);
	sheet.startEditing();
}

function handleEditKeydown(event: KeyboardEvent) {
	if (event.key === 'Enter') {
		event.preventDefault();
		sheet.commitEdit();
		sheet.moveSelection(0, 1);
	} else if (event.key === 'Escape') {
		sheet.cancelEdit();
	} else if (event.key === 'Tab') {
		event.preventDefault();
		sheet.commitEdit();
		sheet.moveSelection(event.shiftKey ? -1 : 1, 0);
	}
}

function handleGridKeydown(event: KeyboardEvent) {
	if (sheet.editing) return;

	switch (event.key) {
		case 'ArrowUp':
			event.preventDefault();
			sheet.moveSelection(0, -1);
			break;
		case 'ArrowDown':
			event.preventDefault();
			sheet.moveSelection(0, 1);
			break;
		case 'ArrowLeft':
			event.preventDefault();
			sheet.moveSelection(-1, 0);
			break;
		case 'ArrowRight':
			event.preventDefault();
			sheet.moveSelection(1, 0);
			break;
		case 'Enter':
		case 'F2':
			event.preventDefault();
			sheet.startEditing();
			break;
		case 'Delete':
		case 'Backspace':
			if (sheet.activeCell) {
				sheet.setCellRaw(sheet.activeCell.col, sheet.activeCell.row, '');
			}
			break;
		case 'Tab':
			event.preventDefault();
			sheet.moveSelection(event.shiftKey ? -1 : 1, 0);
			break;
		default:
			// Start editing on printable character
			if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
				sheet.editValue = event.key;
				sheet.startEditing();
			}
	}
}

function formatDisplay(value: import('$lib/utils/spreadsheet').CellValue): string {
	if (value === null) return '';
	if (typeof value === 'number') {
		return value.toLocaleString();
	}
	return String(value);
}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="sheet-grid-wrap" role="grid" tabindex="0" onkeydown={handleGridKeydown}>
	<table class="sheet-grid">
		<thead>
			<tr>
				<th class="sheet-row-header"></th>
				{#each { length: sheet.cols } as _, c}
					<th class:sheet-col-selected={sheet.activeCell?.col === c}>{sheet.colLabel(c)}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each { length: sheet.rows } as _, r}
				<tr>
					<td class="sheet-row-header" class:sheet-row-selected={sheet.activeCell?.row === r}>{r + 1}</td>
					{#each { length: sheet.cols } as _, c}
						{@const isActive = sheet.isActiveCell(c, r)}
						{@const inRange = sheet.isInSelection(c, r)}
						<td
							class:sheet-selected={isActive}
							class:sheet-in-range={inRange && !isActive}
							class:sheet-num={typeof sheet.cells.get(`${c},${r}`)?.value === 'number'}
							class:sheet-error={!!sheet.cells.get(`${c},${r}`)?.error}
							onclick={(e) => handleCellClick(c, r, e)}
							ondblclick={() => handleCellDblClick(c, r)}
						>
							{#if isActive && sheet.editing}
								<input
									bind:this={editInput}
									class="sheet-edit-input"
									type="text"
									bind:value={sheet.editValue}
									onkeydown={handleEditKeydown}
									onblur={() => sheet.commitEdit()}
								/>
							{:else}
								{sheet.cells.get(`${c},${r}`)?.error ?? formatDisplay(sheet.cells.get(`${c},${r}`)?.value ?? null)}
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.sheet-grid-wrap {
		flex: 1;
		overflow: auto;
		outline: none;
	}

	.sheet-grid {
		border-collapse: collapse;
		font-size: 12px;
		table-layout: fixed;
	}

	.sheet-grid th:not(.sheet-row-header),
	.sheet-grid td:not(.sheet-row-header) {
		width: 80px;
		min-width: 80px;
	}

	.sheet-grid thead th {
		position: sticky;
		top: 0;
		z-index: 1;
		padding: 4px 12px;
		font-weight: 600;
		font-size: 11px;
		text-align: center;
		color: var(--color-muted);
		background: var(--surface-1);
		border-bottom: 1px solid var(--color-border);
		border-right: 1px solid var(--color-border);
	}

	.sheet-col-selected {
		background: color-mix(in srgb, var(--color-primary) 12%, var(--surface-1)) !important;
	}

	.sheet-row-header {
		width: 36px;
		min-width: 36px;
		text-align: center;
		font-size: 11px;
		font-weight: 500;
		color: var(--color-muted);
		background: var(--surface-1);
		border-right: 1px solid var(--color-border);
	}

	.sheet-row-selected {
		background: color-mix(in srgb, var(--color-primary) 12%, var(--surface-1)) !important;
	}

	.sheet-grid td {
		padding: 4px 12px;
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
		border-right: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
		color: var(--color-fg);
		cursor: cell;
		position: relative;
	}

	.sheet-num {
		text-align: right;
		font-family: monospace;
		font-variant-numeric: tabular-nums;
	}

	.sheet-selected {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
	}

	.sheet-in-range {
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
	}

	.sheet-error {
		color: var(--color-error-fg, #ef4444);
		font-size: 11px;
	}

	.sheet-edit-input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		padding: 4px 12px;
		border: none;
		outline: none;
		background: var(--color-bg);
		color: var(--color-fg);
		font-family: monospace;
		font-size: 12px;
		z-index: 2;
	}
</style>
