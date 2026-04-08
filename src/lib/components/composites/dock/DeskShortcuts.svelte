<script lang="ts">
	import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';
	import { getActiveMenus } from './panel-menus.svelte';
	import { getDockContext } from './dock.state.svelte';
	import { getDeskSettings } from './desk-settings.svelte';
	import { hasPanelType, collectLeaves } from './dock.operations';

	import { getWorkspaceContext } from './workspace.state.svelte';

	const dock = getDockContext();
	const deskSettings = getDeskSettings();
	const workspace = getWorkspaceContext();

	// Build View menu for shortcut matching
	const viewMenu = $derived<MenuBarMenu>({
		label: 'View',
		items: [
			{ label: 'Toggle Explorer', shortcut: 'Ctrl+Shift+E', onSelect: () => togglePanelType('explorer') },
			{ label: 'Toggle Preview', shortcut: 'Ctrl+Shift+P', onSelect: () => togglePanelType('preview') },
			{ type: 'separator' },
			{ label: 'Close Active Panel', shortcut: 'Ctrl+W', onSelect: closeFocusedPanel },
		],
	});

	const menus = $derived<MenuBarMenu[]>([
		...getActiveMenus().menuBar,
		viewMenu,
	]);

	// ── Actions ──────────────────────────────────────────────────────

	function togglePanelType(panelType: string) {
		if (hasPanelType(dock.root, panelType, dock.panels)) {
			const leaves = collectLeaves(dock.root);
			for (const leaf of leaves) {
				for (const tabId of leaf.tabs) {
					if (dock.panels[tabId]?.type === panelType) {
						dock.closePanel(tabId);
					}
				}
			}
		} else {
			dock.addPanel({
				id: `${panelType}-${Date.now()}`,
				type: panelType,
				label: panelType.charAt(0).toUpperCase() + panelType.slice(1),
				icon: panelType === 'explorer' ? 'i-lucide-folder-tree' : 'i-lucide-eye',
				closable: true,
			});
		}
	}

	function closeFocusedPanel() {
		const panelId = dock.focusedPanelId;
		if (panelId) dock.closePanel(panelId);
	}

	// ── Keyboard shortcuts ───────────────────────────────────────────

	const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

	function isEditing(el: Element): boolean {
		return INPUT_TAGS.has(el.tagName) || (el as HTMLElement).isContentEditable;
	}

	function normalizeShortcut(e: KeyboardEvent): string {
		const parts: string[] = [];
		if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
		if (e.shiftKey) parts.push('Shift');
		parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
		return parts.join('+');
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (isEditing(e.target as Element)) return;

		const ctrl = e.ctrlKey || e.metaKey;
		if (!ctrl) return;

		// Workspace shortcuts: Ctrl+Alt+1-9
		if (e.altKey && !e.shiftKey) {
			const num = Number.parseInt(e.key);
			if (num >= 1 && num <= 9) {
				const target = workspace.workspaces[num - 1];
				if (target) {
					e.preventDefault();
					workspace.switchTo(target.id);
					return;
				}
			}
		}

		// Global shortcuts (always active)
		if (e.shiftKey) {
			switch (e.key.toUpperCase()) {
				case 'E':
					e.preventDefault();
					togglePanelType('explorer');
					return;
				case 'P':
					e.preventDefault();
					togglePanelType('preview');
					return;
				case ',':
					e.preventDefault();
					deskSettings.openDialog();
					return;
			}
		}

		switch (e.key.toLowerCase()) {
			case 'w':
				e.preventDefault();
				closeFocusedPanel();
				return;
		}

		// Panel-specific shortcuts: search active menus for matching shortcut
		const shortcut = normalizeShortcut(e);
		for (const menu of menus) {
			for (const item of menu.items) {
				if (item.type === 'separator') continue;
				if (item.shortcut && item.shortcut === shortcut && !item.disabled && item.onSelect) {
					e.preventDefault();
					item.onSelect();
					return;
				}
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />
