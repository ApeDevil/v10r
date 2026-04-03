<script lang="ts">
	import { registerPanelContext, updatePanelContext } from '$lib/components/composites/dock';
	import { registerPanelMenus } from '$lib/components/composites/dock';
	import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';
	import SpreadsheetFormulaBar from './SpreadsheetFormulaBar.svelte';
	import SpreadsheetGrid from './SpreadsheetGrid.svelte';
	import SpreadsheetStatusBar from './SpreadsheetStatusBar.svelte';
	import { createSpreadsheetState } from './spreadsheet.state.svelte';

	interface Props {
		panelId: string;
	}

	let { panelId }: Props = $props();

	const sheet = createSpreadsheetState();

	// Load sample data for demonstration
	sheet.setCellRaw(0, 0, 'Category');
	sheet.setCellRaw(1, 0, 'Jan');
	sheet.setCellRaw(2, 0, 'Feb');
	sheet.setCellRaw(3, 0, 'Mar');
	sheet.setCellRaw(0, 1, 'Engineering');
	sheet.setCellRaw(1, 1, '1200');
	sheet.setCellRaw(2, 1, '1350');
	sheet.setCellRaw(3, 1, '1400');
	sheet.setCellRaw(0, 2, 'Marketing');
	sheet.setCellRaw(1, 2, '800');
	sheet.setCellRaw(2, 2, '950');
	sheet.setCellRaw(3, 2, '1100');
	sheet.setCellRaw(0, 3, 'Operations');
	sheet.setCellRaw(1, 3, '450');
	sheet.setCellRaw(2, 3, '475');
	sheet.setCellRaw(3, 3, '500');
	sheet.setCellRaw(0, 4, 'Design');
	sheet.setCellRaw(1, 4, '397');
	sheet.setCellRaw(2, 4, '420');
	sheet.setCellRaw(3, 4, '380');
	sheet.setCellRaw(0, 5, 'Total');
	sheet.setCellRaw(1, 5, '=SUM(B2:B5)');
	sheet.setCellRaw(2, 5, '=SUM(C2:C5)');
	sheet.setCellRaw(3, 5, '=SUM(D2:D5)');

	// ── AI Context registration (800ms debounce) ────────────────────

	let contextTimer: ReturnType<typeof setTimeout>;
	let contextRegistered = false;

	$effect(() => {
		// Register initial context entry
		const cleanup = registerPanelContext({
			panelId,
			panelType: 'spreadsheet',
			label: 'Spreadsheet',
			content: '(no selection)',
			tokenEstimate: 5,
			updatedAt: Date.now(),
		});
		contextRegistered = true;
		return () => {
			clearTimeout(contextTimer);
			contextRegistered = false;
			cleanup();
		};
	});

	// Debounced context updates on selection change
	$effect(() => {
		// Track selection reactively
		const _active = sheet.activeCell;
		const _range = sheet.selectionRange;

		if (!contextRegistered) return;

		clearTimeout(contextTimer);
		contextTimer = setTimeout(() => {
			const ctx = sheet.serializeContext('Sheet1');
			updatePanelContext(panelId, {
				label: ctx.label,
				content: ctx.content,
				tokenEstimate: ctx.tokenEstimate,
				updatedAt: Date.now(),
			});
		}, 800);

		return () => clearTimeout(contextTimer);
	});

	// ── Panel menus ─────────────────────────────────────────────────

	const spreadsheetMenus = $derived<MenuBarMenu[]>([
		{
			label: 'Sheet',
			items: [
				{
					label: 'Clear All',
					icon: 'i-lucide-trash-2',
					onSelect: () => {
						sheet.fromJSON({});
					},
				},
			],
		},
	]);

	$effect(() => {
		return registerPanelMenus(panelId, { menuBar: spreadsheetMenus });
	});
</script>

<div class="sheet-panel">
	<SpreadsheetFormulaBar {sheet} />
	<SpreadsheetGrid {sheet} />
	<SpreadsheetStatusBar stats={sheet.selectionStats} />
</div>

<style>
	.sheet-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--color-bg);
	}
</style>
