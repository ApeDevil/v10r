<script lang="ts">
/**
 * Mobile desk controls — ONE two-region toolbar pill (commands | panels),
 * sitting in the shared bottom-right slot ladder immediately LEFT of the
 * shell's nav FAB (which stays shell-owned; coordination is CSS tokens only,
 * no import edge).
 *
 * position:absolute inside .dock-layout — never `fixed` — so an embedded
 * DockLayout (the dock showcase card) could never leak viewport chrome. Triggers sit
 * BELOW modal scrims (z-fab < z-overlay): while a surface is open they are
 * dimmed + inert behind it, and tap-outside dismisses. They therefore never
 * show open/close state (a raised "X" here would be unreachable).
 */
import * as m from '$lib/paraglide/messages';
import { getDockMobile } from './dock-mobile.state.svelte';

interface Props {
	openCount: number;
}

let { openCount }: Props = $props();

const mobile = getDockMobile();
</script>

<div class="dock-mobile-controls fab-keyboard-hide">
	<button
		type="button"
		class="pill-region pill-commands"
		aria-haspopup="dialog"
		aria-label={m.composites_dock_mobile_commands()}
		disabled={openCount === 0}
		onclick={() => mobile.toggle('commands')}
	>
		<span class="i-lucide-ellipsis-vertical pill-icon" aria-hidden="true"></span>
	</button>
	<span class="pill-divider" aria-hidden="true"></span>
	<button
		type="button"
		class="pill-region pill-panels"
		aria-haspopup="dialog"
		aria-label={openCount > 0
			? `${m.composites_dock_mobile_panels_title()} (${openCount})`
			: m.composites_dock_mobile_panels_title()}
		onclick={() => mobile.toggle('panels')}
	>
		<span class="i-lucide-panels-top-left pill-icon" aria-hidden="true"></span>
		{#if openCount > 0}
			<span class="pill-count" aria-hidden="true">{openCount}</span>
		{/if}
	</button>
</div>

<style>
	.dock-mobile-controls {
		/* Viewport-fixed like the shell FAB — both must measure --fab-bottom-1
			from the same origin or the row misaligns whenever the dock box bottom
			(min-h-100svh) and the visual viewport bottom diverge. Floating chrome
			is viewport chrome; mobileChrome="bar" is the contained variant. */
		position: fixed;
		right: var(--fab-right-2);
		bottom: var(--fab-bottom-1);
		z-index: var(--z-fab);
		display: flex;
		align-items: center;
		height: var(--fab-size);
		border-radius: var(--radius-full);
		border: 1px solid var(--color-border);
		background: var(--surface-2);
		box-shadow: var(--shadow-lg);
		overflow: hidden;
	}

	.pill-region {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 52px;
		height: 100%;
		border: none;
		background: transparent;
		color: var(--color-fg);
		cursor: pointer;
	}

	.pill-region:active {
		background: var(--color-fg-alpha);
	}

	.pill-region:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.pill-commands {
		color: var(--color-muted);
	}

	.pill-commands:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.pill-divider {
		width: 1px;
		align-self: stretch;
		margin: 10px 0;
		background: var(--color-border);
	}

	.pill-icon {
		width: 22px;
		height: 22px;
	}

	.pill-count {
		position: absolute;
		top: 8px;
		right: 6px;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		border-radius: var(--radius-full);
		background: var(--color-primary);
		color: var(--color-on-primary);
		font-size: 10px;
		font-weight: 700;
		line-height: 16px;
		text-align: center;
	}
</style>
