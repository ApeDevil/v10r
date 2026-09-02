<script lang="ts">
/**
 * Mobile header: horizontally-scrollable strip of OPEN panel instances —
 * the always-visible "which panel am I in / what else is open" signal.
 * In-flow (grid row above the keep-alive stack), so it can never occlude
 * content (WCAG 2.4.11) and inherits the desk theme vars.
 *
 * Tap = switch (focusPanel). Closing stays explicit in the panels drawer and
 * the commands sheet — no close targets in a 44px scrolling strip.
 */
import * as m from '$lib/paraglide/messages';
import { cn } from '$lib/utils/cn';
import { getDockContext } from './dock.state.svelte';
import { focusPanel } from './panel-actions';

interface Props {
	openPanelIds: string[];
	visibleId: string | null;
}

let { openPanelIds, visibleId }: Props = $props();

const dock = getDockContext();

let stripEl = $state<HTMLElement | undefined>(undefined);

// Keep the active tab in view as focus moves (AI effects, drawer taps).
$effect(() => {
	void visibleId;
	if (!stripEl) return;
	stripEl.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
});
</script>

<nav bind:this={stripEl} class="dock-mobile-tabs" aria-label={m.composites_dock_mobile_tabs()}>
	{#each openPanelIds as id (id)}
		{@const panel = dock.panels[id]}
		{#if panel}
			<button
				type="button"
				class="dock-mobile-tab"
				class:active={id === visibleId}
				aria-current={id === visibleId ? 'true' : undefined}
				aria-label={panel.indicator ? `${panel.label} (${panel.indicator})` : panel.label}
				onclick={() => focusPanel(dock, id)}
			>
				{#if panel.icon}<span class={cn(panel.icon, 'tab-icon')} aria-hidden="true"></span>{/if}
				<span class="tab-label">{panel.label}</span>
				{#if panel.indicator}
					<span class={cn('dock-tab-dot', `dot-${panel.indicator}`)} aria-hidden="true"></span>
				{/if}
			</button>
		{/if}
	{/each}
</nav>

<style>
	.dock-mobile-tabs {
		display: flex;
		align-items: stretch;
		gap: var(--spacing-1);
		height: 44px;
		flex-shrink: 0;
		padding: 0 var(--spacing-2);
		overflow-x: auto;
		overflow-y: hidden;
		border-bottom: 1px solid var(--color-border);
		background: var(--desk-shell-bg, var(--color-bg));
		scrollbar-width: none;
	}

	.dock-mobile-tabs::-webkit-scrollbar {
		display: none;
	}

	.dock-mobile-tab {
		position: relative;
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
		max-width: 45vw;
		padding: 0 var(--spacing-3);
		border: none;
		background: transparent;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		cursor: pointer;
	}

	.dock-mobile-tab.active {
		color: var(--color-fg);
	}

	/* Active pip on the bottom edge (mirrors the desktop tab indicator). */
	.dock-mobile-tab.active::after {
		content: '';
		position: absolute;
		left: var(--spacing-2);
		right: var(--spacing-2);
		bottom: 0;
		height: 2px;
		border-radius: 1px;
		background: var(--desk-tab-active-indicator, var(--color-primary));
	}

	.dock-mobile-tab:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.tab-icon {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.tab-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Instance status dots — same vocabulary as DockTabBar's desktop tabs. */
	.dock-tab-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.dock-tab-dot.dot-unsaved,
	.dock-tab-dot.dot-ai-modified {
		background: var(--color-warning);
	}

	.dock-tab-dot.dot-saving {
		background: var(--color-muted);
		animation: tab-dot-pulse 1s ease-in-out infinite;
	}

	.dock-tab-dot.dot-error,
	.dock-tab-dot.dot-ai-error {
		background: var(--color-error);
	}

	.dock-tab-dot.dot-ai-active {
		background: var(--color-primary);
		animation: tab-dot-pulse 1s ease-in-out infinite;
	}

	@keyframes tab-dot-pulse {
		50% {
			opacity: 0.3;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dock-tab-dot {
			animation: none;
		}
	}
</style>
