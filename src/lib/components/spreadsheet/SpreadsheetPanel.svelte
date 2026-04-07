<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { apiFetch } from '$lib/api';
	import { getDeskBus, getDockContext, registerPanelContext, updatePanelContext } from '$lib/components/composites/dock';
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
	const dock = getDockContext();

	// ── Persistence ─────────────────────────────────────────────────

	/** File-mode: panelId is "spreadsheet-fil_xxx" → extract fileId. Legacy: null. */
	const fileId = $derived(
		panelId.startsWith('spreadsheet-fil_') ? panelId.replace('spreadsheet-', '') : null,
	);

	const STORAGE_KEY = `desk-spreadsheet-${panelId}`;
	let spreadsheetId: string | null = $state(null);
	let saveStatus: 'idle' | 'saving' | 'saved' | 'error' = $state('idle');
	let loaded = $state(false);

	/** File-mode: load spreadsheet by file ID from desk.file API. */
	async function initFromFile(fId: string) {
		try {
			const res = await apiFetch(`/api/desk/files/${fId}`);
			if (res.ok) {
				const json = await res.json();
				const payload = json.data ?? json;
				const cells = payload.spreadsheet?.cells as Record<string, { v: string | number | null; f?: string; t?: string }> | undefined;
				if (cells && Object.keys(cells).length > 0) {
					sheet.fromJSON(cells);
				}
				loaded = true;
				return;
			}
		} catch {
			// File not found or network error
		}
		loaded = true;
	}

	/** Legacy mode: load from localStorage or create new. */
	async function initFromLocalStorage() {
		const storedId = localStorage.getItem(STORAGE_KEY);

		if (storedId) {
			try {
				const res = await apiFetch(`/api/desk/spreadsheets/${storedId}`);
				if (res.ok) {
					const { spreadsheet } = await res.json();
					spreadsheetId = spreadsheet.id;
					const cells = spreadsheet.cells as Record<string, { v: string | number | null; f?: string; t?: string }>;
					if (cells && Object.keys(cells).length > 0) {
						sheet.fromJSON(cells);
					} else {
						loadSampleData();
					}
					loaded = true;
					return;
				}
			} catch {
				// Stored ID invalid — fall through to create
			}
			localStorage.removeItem(STORAGE_KEY);
		}

		// Create new spreadsheet
		try {
			loadSampleData();
			const res = await apiFetch('/api/desk/spreadsheets', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: sheetName, cells: sheet.toJSON() }),
			});
			if (res.ok) {
				const { spreadsheet } = await res.json();
				spreadsheetId = spreadsheet.id;
				localStorage.setItem(STORAGE_KEY, spreadsheet.id);
			}
		} catch {
			// Offline or auth issue — still works locally
		}
		loaded = true;
	}

	function loadSampleData() {
		sheet.fromJSON({
			A1: { v: 'Category' },
			B1: { v: 'Jan' },
			C1: { v: 'Feb' },
			D1: { v: 'Mar' },
			A2: { v: 'Engineering' },
			B2: { v: 1200 },
			C2: { v: 1350 },
			D2: { v: 1400 },
			A3: { v: 'Marketing' },
			B3: { v: 800 },
			C3: { v: 950 },
			D3: { v: 1100 },
			A4: { v: 'Operations' },
			B4: { v: 450 },
			C4: { v: 475 },
			D4: { v: 500 },
			A5: { v: 'Design' },
			B5: { v: 397 },
			C5: { v: 420 },
			D5: { v: 380 },
			A6: { v: 'Total' },
			B6: { v: null, f: '=SUM(B2:B5)' },
			C6: { v: null, f: '=SUM(C2:C5)' },
			D6: { v: null, f: '=SUM(D2:D5)' },
		});
	}

	// Init on mount (not $effect — setCellRaw writes $state, which would trigger infinite loops)
	onMount(() => {
		if (fileId) {
			initFromFile(fileId);
		} else {
			initFromLocalStorage();
		}
	});

	// ── AI refresh subscription ─────────────────────────────────────

	const bus = getDeskBus();

	$effect(() => {
		const fId = fileId;
		if (!fId) return;

		return bus.subscribe('ai:refresh_file', async ({ fileId: refreshId }) => {
			if (refreshId !== fId) return;
			try {
				const res = await apiFetch(`/api/desk/files/${fId}`);
				if (res.ok) {
					const json = await res.json();
					const payload = json.data ?? json;
					const cells = payload.spreadsheet?.cells as Record<string, { v: string | number | null; f?: string; t?: string }> | undefined;
					if (cells) {
						sheet.fromJSON(cells);
						saveStatus = 'saved';
						setTimeout(() => { saveStatus = 'idle'; }, 2000);
					}
				}
			} catch {
				saveStatus = 'error';
			}
		});
	});

	// ── Auto-save (1.5s debounce after cell changes) ────────────────

	let saveTimer: ReturnType<typeof setTimeout>;

	$effect(() => {
		const dirty = sheet.dirty;
		const fId = fileId;
		if (!loaded || dirty === 0) return;
		// Need either a fileId (file-mode) or spreadsheetId (legacy) to save
		if (!fId && !spreadsheetId) return;

		clearTimeout(saveTimer);
		saveTimer = setTimeout(async () => {
			saveStatus = 'saving';
			try {
				const url = fId
					? `/api/desk/files/${fId}`
					: `/api/desk/spreadsheets/${spreadsheetId}`;
				const res = await apiFetch(url, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ cells: sheet.toJSON() }),
				});
				saveStatus = res.ok ? 'saved' : 'error';
				if (saveStatus === 'saved') {
					setTimeout(() => { saveStatus = 'idle'; }, 2000);
				}
			} catch {
				saveStatus = 'error';
			}
		}, 1500);

		return () => clearTimeout(saveTimer);
	});

	// ── AI Context registration (800ms debounce) ────────────────────

	let contextTimer: ReturnType<typeof setTimeout>;
	// Plain variable (not $state) — only used as a guard flag within this component
	let contextRegistered = false;

	/** Derive the sheet name from the dock panel label (falls back to 'Sheet'). */
	const sheetName = $derived(dock.panels[panelId]?.label || 'Sheet');

	// Register once on mount. untrack prevents re-running when sheet state changes.
	$effect(() => {
		const ctx = untrack(() => sheet.serializeContext(sheetName));
		const cleanup = registerPanelContext({
			panelId,
			panelType: 'spreadsheet',
			label: ctx.label,
			content: ctx.content,
			tokenEstimate: ctx.tokenEstimate,
			updatedAt: Date.now(),
		});
		contextRegistered = true;
		return () => {
			clearTimeout(contextTimer);
			contextRegistered = false;
			cleanup();
		};
	});

	// Debounced context updates on selection/cell change
	$effect(() => {
		// Read reactive deps to establish tracking
		const _active = sheet.activeCell;
		const _range = sheet.selectionRange;
		const _dirty = sheet.dirty;

		if (!contextRegistered) return;

		clearTimeout(contextTimer);
		contextTimer = setTimeout(() => {
			const ctx = sheet.serializeContext(sheetName);
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
	{#if saveStatus === 'saving'}
		<div class="save-indicator">Saving...</div>
	{:else if saveStatus === 'saved'}
		<div class="save-indicator saved">Saved</div>
	{:else if saveStatus === 'error'}
		<div class="save-indicator error">Save failed</div>
	{/if}
</div>

<style>
	.sheet-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--desk-panel-bg, var(--color-bg));
		position: relative;
	}

	.save-indicator {
		position: absolute;
		top: 4px;
		right: 8px;
		font-size: 11px;
		color: var(--color-muted);
		pointer-events: none;
		z-index: 5;
	}

	.save-indicator.saved {
		color: var(--color-primary);
	}

	.save-indicator.error {
		color: var(--color-error-fg, #ef4444);
	}
</style>
