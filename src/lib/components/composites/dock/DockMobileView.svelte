<script lang="ts">
/**
 * Mobile (<768px) desk mode: ONE panel visible full-height.
 *
 * Contract: the dock state stays the single source of truth — the visible
 * panel IS `dock.focusedPanelId` (total derivation), so anything that focuses
 * a panel (user tap, ?open=/?panel=, AI effects, addPanel's insertion focus)
 * surfaces it here with no view-local pointer or diffing machinery. Mobile
 * performs only NON-STRUCTURAL operations (focusPanel / ensurePanelType /
 * closePanel), so the persisted desktop tree SHAPE is untouched.
 *
 * Two chromes:
 *  'floating' — open-panels tab strip on top; the floating controls pill and
 *               its surfaces are rendered by DockLayout as siblings. Panels
 *               reserve --fab-reserve-bottom so the control row never covers
 *               bottom-anchored UI (chat input, status bars) or the AI-Act
 *               disclosure line.
 *  'bar'      — the contained bottom switcher bar (embedded consumers, e.g.
 *               the workbench showcase card: a 500px card cannot host
 *               floating chrome).
 */
import type { Snippet } from 'svelte';
import * as m from '$lib/paraglide/messages';
import { getModals } from '$lib/state/modals.svelte';
import { cn } from '$lib/utils/cn';
import DockMobileBar from './DockMobileBar.svelte';
import DockMobileTabs from './DockMobileTabs.svelte';
import { getDeskSettings } from './desk-settings.svelte';
import { getDockContext } from './dock.state.svelte';
import type { ActivityBarItem } from './dock.types';
import { focusPanel, openOrCycle } from './panel-actions';

interface Props {
	items: ActivityBarItem[];
	chrome: 'floating' | 'bar';
	openPanelIds: string[];
	visibleId: string | null;
	panelContent: Snippet<[string]>;
}

let { items, chrome, openPanelIds, visibleId, panelContent }: Props = $props();

const dock = getDockContext();
const deskSettings = getDeskSettings();
const modals = getModals();
</script>

<div class="dock-mobile-view" data-chrome={chrome}>
	{#if chrome === 'floating' && openPanelIds.length > 0}
		<DockMobileTabs {openPanelIds} {visibleId} />
	{/if}

	<div class="dock-mobile-content">
		{#if openPanelIds.length === 0}
			<!-- Recovery surface, not a message: the panel types themselves,
				same items/order/tap semantics as the drawer. -->
			<div class="dock-mobile-empty">
				<span class="i-lucide-layout-grid empty-icon" aria-hidden="true"></span>
				<p>{m.composites_dock_mobile_empty()}</p>
				<div class="empty-grid">
					{#each items as item (item.panelType)}
						<button type="button" class="empty-type" onclick={() => openOrCycle(dock, items, item.panelType)}>
							<span class={cn(item.icon, 'empty-type-icon')} aria-hidden="true"></span>
							<span>{item.label}</span>
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<!-- Keep-alive: every open panel stays mounted (mirrors DockLeaf's stacked
				tab panels) — switching must not destroy editor buffers or chat state. -->
			{#each openPanelIds as id (id)}
				<div class="dock-mobile-panel" class:active={id === visibleId}>
					{@render panelContent(id)}
				</div>
			{/each}
		{/if}
	</div>

	{#if chrome === 'bar'}
		<DockMobileBar
			{items}
			panels={dock.panels}
			{openPanelIds}
			{visibleId}
			onSelect={(panelType) => openOrCycle(dock, items, panelType)}
			onShowPanel={(panelId) => focusPanel(dock, panelId)}
			onCloseCurrent={() => {
				if (visibleId) dock.closePanel(visibleId);
			}}
			onOpenPreferences={() => deskSettings.openDialog()}
			onOpenSearch={() => modals.open('quickSearch')}
		/>
	{/if}
</div>

<style>
	.dock-mobile-view {
		grid-area: content;
		display: flex;
		flex-direction: column;
		min-height: 0;
		min-width: 0;
	}

	.dock-mobile-content {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.dock-mobile-panel {
		position: absolute;
		inset: 0;
		display: none;
		overflow: auto;
	}

	/* Honest occlusion reservation: the floating control row never covers
		bottom-anchored panel UI — every panel gives up the same strip. */
	.dock-mobile-view[data-chrome='floating'] .dock-mobile-panel {
		padding-bottom: var(--fab-reserve-bottom);
		scroll-padding-bottom: var(--fab-reserve-bottom);
	}

	.dock-mobile-panel.active {
		display: block;
	}

	.dock-mobile-empty {
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-3);
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		text-align: center;
		padding: var(--spacing-6);
	}

	.dock-mobile-empty .empty-icon {
		width: 32px;
		height: 32px;
		opacity: 0.6;
	}

	.empty-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--spacing-2);
		width: 100%;
		max-width: 22rem;
	}

	.empty-type {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		min-height: 56px;
		padding: 0 var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
		cursor: pointer;
	}

	.empty-type:active {
		background: var(--color-fg-alpha);
	}

	.empty-type:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.empty-type-icon {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}
</style>
