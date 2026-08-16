<script lang="ts">
import { Dialog as DialogPrimitive } from 'bits-ui';
import type { Snippet } from 'svelte';
import * as m from '$lib/paraglide/messages';
import { layerStack } from '$lib/state/layer-stack.svelte';
import { useSurface } from '$lib/styles/elevation';
import { cn } from '$lib/utils/cn';

interface Props {
	open: boolean;
	side?: 'left' | 'right' | 'bottom';
	title?: string;
	/**
	 * layerStack id — registers while open so hand-rolled dismissal guards
	 * (e.g. SidebarDrawer's wasTop checks) stay correct when this drawer
	 * coexists with them. Omit to opt out.
	 */
	layerId?: string;
	children?: Snippet;
	class?: string;
}

let {
	open = $bindable(false),
	side = 'right',
	title = m.primitives_drawer_title(),
	layerId,
	children,
	class: className,
}: Props = $props();

// Relative elevation — one rung above the surface this drawer was opened from (its scrim
// carries the separation).
const s = useSurface();

// Effect-scoped with cleanup: an unmount-while-open (breakpoint cross) must
// pop the layer, or wasTop() goes false for everyone and Escape dies app-wide.
$effect(() => {
	if (open && layerId) {
		layerStack.push(layerId);
		return () => layerStack.pop(layerId);
	}
});

const sideClasses = {
	left: 'inset-y-0 left-0 h-full w-3/4 max-w-sm',
	right: 'inset-y-0 right-0 h-full w-3/4 max-w-sm',
	bottom: 'inset-x-0 bottom-0 h-auto max-h-[85svh] drawer-safe-bottom',
};
</script>

<DialogPrimitive.Root bind:open>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="drawer-scrim fixed inset-0 z-overlay bg-black/50" />
		<DialogPrimitive.Content
			{...s.attrs}
			data-side={side}
			class={cn('drawer-content fixed z-drawer border', sideClasses[side], className)}
		>
			<div class="flex h-full flex-col">
				<div class="flex items-center justify-between border-b border-border px-4 py-3">
					<DialogPrimitive.Title class="text-fluid-lg font-semibold text-fg">
						{title}
					</DialogPrimitive.Title>
					<DialogPrimitive.Close
						class="rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
					>
						<span class="i-lucide-x h-4 w-4"></span>
						<span class="sr-only">{m.primitives_drawer_close()}</span>
					</DialogPrimitive.Close>
				</div>

				{#if children}
					<div class="flex-1 overflow-y-auto p-4">
						{@render children()}
					</div>
				{/if}
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>

<style>
	/* Enter animations (transform/opacity only). Enter-only by design: bits
	   unmounts the node on close, and an instant close reads far better than
	   a forceMount dance. Template: SidebarDrawer's hand-rolled keyframes. */
	:global(.drawer-scrim) {
		animation: -global-drawer-fade-in var(--duration-fast) both;
	}

	:global(.drawer-content[data-side='left']) {
		animation: -global-drawer-in-left var(--duration-normal) var(--ease-default) both;
	}

	:global(.drawer-content[data-side='right']) {
		animation: -global-drawer-in-right var(--duration-normal) var(--ease-default) both;
	}

	:global(.drawer-content[data-side='bottom']) {
		animation: -global-drawer-in-bottom var(--duration-normal) var(--ease-default) both;
	}

	/* Bottom sheets sit on the home-indicator edge (0px in regular browsers). */
	:global(.drawer-safe-bottom) {
		padding-bottom: max(env(safe-area-inset-bottom), 12px);
	}

	@keyframes -global-drawer-fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes -global-drawer-in-left {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(0);
		}
	}

	@keyframes -global-drawer-in-right {
		from {
			transform: translateX(100%);
		}
		to {
			transform: translateX(0);
		}
	}

	@keyframes -global-drawer-in-bottom {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.drawer-scrim),
		:global(.drawer-content) {
			animation: none;
		}
	}
</style>
