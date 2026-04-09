<script lang="ts">
import { ContextMenu as ContextMenuPrimitive } from 'bits-ui';
import { contextMenuContentVariants, contextMenuItemVariants } from '$lib/components/composites/context-menu';
import { cn } from '$lib/utils/cn';
import { getDeskSettings } from './desk-settings.svelte';
import { collectLeaves, hasPanelType } from './dock.operations';
import { getDockContext } from './dock.state.svelte';
import type { ActivityBarItem, ActivityBarPosition, PanelDefinition } from './dock.types';
import WorkspaceZone from './WorkspaceZone.svelte';

interface Props {
	items: ActivityBarItem[];
	position?: ActivityBarPosition;
	class?: string;
}

let { items, position = 'left', class: className }: Props = $props();

const dock = getDockContext();
const deskSettings = getDeskSettings();

const isHorizontal = $derived(position === 'top' || position === 'bottom');

const POSITION_OPTIONS: { pos: ActivityBarPosition; label: string; icon: string }[] = [
	{ pos: 'left', label: 'Left', icon: 'i-lucide-panel-left' },
	{ pos: 'right', label: 'Right', icon: 'i-lucide-panel-right' },
	{ pos: 'top', label: 'Top', icon: 'i-lucide-panel-top' },
	{ pos: 'bottom', label: 'Bottom', icon: 'i-lucide-panel-bottom' },
];

function isTypeInLayout(panelType: string): boolean {
	return hasPanelType(dock.root, panelType, dock.panels);
}

function handleClick(item: ActivityBarItem) {
	if (isTypeInLayout(item.panelType)) {
		const leaves = collectLeaves(dock.root);
		for (const leaf of leaves) {
			for (const tabId of leaf.tabs) {
				const panel = dock.panels[tabId];
				if (panel?.type === item.panelType) {
					dock.closePanel(tabId);
				}
			}
		}
	} else {
		const panel: PanelDefinition = {
			id: `${item.panelType}-${Date.now()}`,
			type: item.panelType,
			label: item.label,
			icon: item.icon,
			closable: true,
		};
		dock.addPanel(panel);
	}
}
</script>

<ContextMenuPrimitive.Root>
	<ContextMenuPrimitive.Trigger class="focus-visible:outline-none">
		{#snippet child({ props })}
			<div
				{...props}
				class={cn('dock-activity-bar', isHorizontal && 'horizontal', className)}
				data-position={position}
				role="toolbar"
				aria-label="Activity bar"
			>
				{#each items as item (item.panelType)}
					{@const active = isTypeInLayout(item.panelType)}
					<button
						class={cn('dock-activity-btn', active && 'active')}
						title={item.label}
						aria-pressed={active}
						onclick={() => handleClick(item)}
					>
						<span class={cn('dock-activity-icon', item.icon)}></span>
					</button>
				{/each}
					<div class="dock-activity-spacer"></div>
					<WorkspaceZone />
					<button
						class="dock-activity-btn"
						title="Desk Preferences"
						onclick={() => deskSettings.openDialog()}
					>
						<span class={cn('dock-activity-icon', 'i-lucide-settings')}></span>
					</button>
			</div>
		{/snippet}
	</ContextMenuPrimitive.Trigger>

	<ContextMenuPrimitive.Portal>
		<ContextMenuPrimitive.Content class={contextMenuContentVariants()}>
			<ContextMenuPrimitive.Group>
				<ContextMenuPrimitive.GroupHeading class="px-2 py-1.5 text-xs font-medium text-muted">
					Activity Bar Position
				</ContextMenuPrimitive.GroupHeading>
				{#each POSITION_OPTIONS as opt (opt.pos)}
					<ContextMenuPrimitive.CheckboxItem
						checked={position === opt.pos}
						class={contextMenuItemVariants()}
						onCheckedChange={() => dock.setActivityBarPosition(opt.pos)}
					>
						{#snippet children({ checked })}
							<span class={cn(opt.icon, 'h-4 w-4')}></span>
							<span class="flex-1">{opt.label}</span>
							{#if checked}
								<span class="i-lucide-check h-4 w-4"></span>
							{/if}
						{/snippet}
					</ContextMenuPrimitive.CheckboxItem>
				{/each}
			</ContextMenuPrimitive.Group>
		</ContextMenuPrimitive.Content>
	</ContextMenuPrimitive.Portal>
</ContextMenuPrimitive.Root>

<style>
	.dock-activity-bar {
		grid-area: bar;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 4px;
		background: var(--desk-shell-bg, var(--color-bg));
		width: 40px;
		flex-shrink: 0;
	}

	.dock-activity-spacer {
		flex: 1;
	}

	.dock-activity-bar.horizontal {
		flex-direction: row;
		width: auto;
		height: 40px;
	}

	/* Border on the edge facing dock-content */
	.dock-activity-bar[data-position='left'] {
		border-right: 1px solid var(--color-border);
	}

	.dock-activity-bar[data-position='right'] {
		border-left: 1px solid var(--color-border);
	}

	.dock-activity-bar[data-position='top'] {
		border-bottom: 1px solid var(--color-border);
	}

	.dock-activity-bar[data-position='bottom'] {
		border-top: 1px solid var(--color-border);
	}

	.dock-activity-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md);
		color: var(--color-muted);
		position: relative;
		cursor: pointer;
	}

	.dock-activity-btn:hover {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-fg) 8%, transparent);
	}

	.dock-activity-btn.active {
		color: var(--color-fg);
	}

	/* Active indicator pip — position depends on bar edge */
	.dock-activity-bar[data-position='left'] .dock-activity-btn.active::before {
		content: '';
		position: absolute;
		left: -4px;
		top: 6px;
		bottom: 6px;
		width: 2px;
		background: var(--color-primary);
		border-radius: var(--radius-full);
	}

	.dock-activity-bar[data-position='right'] .dock-activity-btn.active::before {
		content: '';
		position: absolute;
		right: -4px;
		top: 6px;
		bottom: 6px;
		width: 2px;
		background: var(--color-primary);
		border-radius: var(--radius-full);
	}

	.dock-activity-bar[data-position='top'] .dock-activity-btn.active::before {
		content: '';
		position: absolute;
		top: -4px;
		left: 6px;
		right: 6px;
		height: 2px;
		background: var(--color-primary);
		border-radius: var(--radius-full);
	}

	.dock-activity-bar[data-position='bottom'] .dock-activity-btn.active::before {
		content: '';
		position: absolute;
		bottom: -4px;
		left: 6px;
		right: 6px;
		height: 2px;
		background: var(--color-primary);
		border-radius: var(--radius-full);
	}

	.dock-activity-btn:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.dock-activity-icon {
		font-size: 20px;
	}

	/* Context menu highlight fix */
	:global([data-context-menu-content] [role='menuitemcheckbox'][data-highlighted]) {
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}
</style>
