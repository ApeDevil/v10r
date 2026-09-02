<script lang="ts">
/**
 * Bottom panel-switcher for the desk's mobile mode. Presentational — all
 * behavior arrives via callbacks (DockMobileView owns the state).
 *
 * Tap semantics: SHOW, never toggle-close (deliberately NOT DockActivityBar's
 * click behavior, which closes all panels of a type). A type with several open
 * instances shows a count badge and cycles on repeated taps; the kebab lists
 * every open panel for direct disambiguation.
 */
import { DropdownMenu } from 'bits-ui';
import type { ActivityBarItem, PanelDefinition } from '$lib/desk/layout.types';
import * as m from '$lib/paraglide/messages';
import { useSurface } from '$lib/styles/elevation';

interface Props {
	items: ActivityBarItem[];
	panels: Record<string, PanelDefinition>;
	openPanelIds: string[];
	visibleId: string | null;
	onSelect: (panelType: string) => void;
	onShowPanel: (panelId: string) => void;
	onCloseCurrent: () => void;
	onOpenPreferences: () => void;
	onOpenSearch: () => void;
}

let {
	items,
	panels,
	openPanelIds,
	visibleId,
	onSelect,
	onShowPanel,
	onCloseCurrent,
	onOpenPreferences,
	onOpenSearch,
}: Props = $props();

// Relative elevation — one rung above the surface that owns the trigger.
const s = useSurface();

const activeType = $derived(visibleId ? (panels[visibleId]?.type ?? null) : null);

const counts = $derived(
	openPanelIds.reduce<Record<string, number>>((acc, id) => {
		const type = panels[id]?.type;
		if (type) acc[type] = (acc[type] ?? 0) + 1;
		return acc;
	}, {}),
);

const MENU_ITEM_CLASS =
	'flex items-center gap-3 p-2 px-3 rounded-sm text-fg text-sm cursor-pointer outline-none data-[highlighted]:bg-fg-alpha';
</script>

<nav class="dock-mobile-bar" aria-label={m.composites_dock_mobile_bar()}>
	<div class="bar-scroll" role="toolbar" aria-label={m.composites_dock_mobile_bar()}>
		{#each items as item (item.panelType)}
			{@const count = counts[item.panelType] ?? 0}
			<button
				type="button"
				class="bar-button"
				class:active={item.panelType === activeType}
				aria-pressed={item.panelType === activeType}
				aria-label={count > 1 ? `${item.label} (${count} open)` : item.label}
				title={item.label}
				onclick={() => onSelect(item.panelType)}
			>
				<span class="{item.icon} bar-icon" aria-hidden="true"></span>
				{#if count > 1}
					<span class="bar-count" aria-hidden="true">{count}</span>
				{/if}
			</button>
		{/each}

		<DropdownMenu.Root>
			<DropdownMenu.Trigger class="bar-button" aria-label={m.composites_dock_mobile_more()}>
				<span class="i-lucide-ellipsis-vertical bar-icon" aria-hidden="true"></span>
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					{...s.attrs}
					class="z-dropdown min-w-[14rem] max-w-[calc(100vw-1rem)] max-h-[var(--bits-dropdown-menu-content-available-height,20rem)] overflow-y-auto border rounded-md p-2"
					side="top"
					align="end"
					sideOffset={8}
					collisionPadding={8}
				>
					<DropdownMenu.GroupHeading class="px-3 py-1 text-xs text-muted">
						{m.composites_dock_mobile_open_panels()}
					</DropdownMenu.GroupHeading>
					{#each openPanelIds as id (id)}
						{@const panel = panels[id]}
						{#if panel}
							<DropdownMenu.Item class={MENU_ITEM_CLASS} onclick={() => onShowPanel(id)}>
								{#if panel.icon}<span class="{panel.icon} text-lg" aria-hidden="true"></span>{/if}
								<span class:font-semibold={id === visibleId}>{panel.label}</span>
							</DropdownMenu.Item>
						{/if}
					{/each}

					<DropdownMenu.Separator class="h-px bg-border my-1" />

					{#if visibleId}
						<DropdownMenu.Item class={MENU_ITEM_CLASS} onclick={onCloseCurrent}>
							<span class="i-lucide-x text-lg" aria-hidden="true"></span>
							<span>{m.composites_dock_mobile_close_panel()}</span>
						</DropdownMenu.Item>
					{/if}
					<DropdownMenu.Item class={MENU_ITEM_CLASS} onclick={onOpenSearch}>
						<span class="i-lucide-search text-lg" aria-hidden="true"></span>
						<span>{m.composites_dock_mobile_search()}</span>
					</DropdownMenu.Item>
					<DropdownMenu.Item class={MENU_ITEM_CLASS} onclick={onOpenPreferences}>
						<span class="i-lucide-settings-2 text-lg" aria-hidden="true"></span>
						<span>{m.composites_dock_mobile_preferences()}</span>
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>

		<!-- Inert spacer: lets the strip scroll items clear of the fixed SidebarFab
			(bottom-right) — the FAB is the only nav affordance on the immersive desk. -->
		<span class="bar-spacer" aria-hidden="true"></span>
	</div>
</nav>

<style>
	.dock-mobile-bar {
		flex-shrink: 0;
		border-top: 1px solid var(--color-border);
		background: var(--color-bg);
		padding-bottom: var(--safe-bottom, 0px);
	}

	.bar-scroll {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		overflow-x: auto;
		padding: var(--spacing-1) var(--spacing-2);
	}

	/* bits-ui renders the trigger with our class too — style both via :global */
	.bar-scroll :global(.bar-button) {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 48px;
		height: 48px;
		border: none;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-fg);
		cursor: pointer;
	}

	.bar-scroll :global(.bar-button:active) {
		background: var(--color-fg-alpha);
	}

	.bar-scroll :global(.bar-button.active) {
		color: var(--color-primary);
	}

	/* Active pip on the top edge (mirrors the activity bar's position marker) */
	.bar-scroll :global(.bar-button.active)::before {
		content: '';
		position: absolute;
		top: 0;
		left: 25%;
		right: 25%;
		height: 2px;
		border-radius: 1px;
		background: var(--color-primary);
	}

	.bar-scroll :global(.bar-icon) {
		width: 22px;
		height: 22px;
	}

	.bar-count {
		position: absolute;
		top: 4px;
		right: 4px;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		border-radius: 8px;
		background: var(--color-primary);
		color: var(--color-bg);
		font-size: 10px;
		font-weight: 700;
		line-height: 16px;
		text-align: center;
	}

	.bar-spacer {
		flex: 0 0 80px;
	}
</style>
