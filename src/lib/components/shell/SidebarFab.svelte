<script lang="ts">
import { Button } from '$lib/components/primitives/button';
import { getSidebar } from '$lib/state/sidebar.svelte';
import { cn } from '$lib/utils/cn';

interface Props {
	class?: string;
}

let { class: className }: Props = $props();

const sidebar = getSidebar();

function handleClick() {
	sidebar.toggleMobile();
}
</script>

<!-- No open/close icon swap: while the drawer is open this FAB sits UNDER the
	scrim (z-fab 20 < z-overlay 30) and outside the focus trap — an X state here
	is unreachable by pointer, keyboard, or screen reader. The drawer owns its
	own close affordance. Position comes from the shared --fab-* slot tokens
	(slot: row 1, corner); fab-keyboard-hide vacates it under the virtual keyboard. -->
<Button
	variant="default"
	class={cn(
		'sidebar-fab fab-keyboard-hide hover:scale-105 hover:shadow-xl active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100',
		className
	)}
	onclick={handleClick}
	aria-label="Open menu"
>
	{#snippet children()}
		<span class="i-lucide-menu text-icon-lg"></span>
	{/snippet}
</Button>

<style>
	/* Geometry lives here, not in utilities: Button's md-size classes (h-10,
		px-4, rounded-md) share the element and cn() is clsx-only, so a utility
		fight is decided by UnoCSS rule order — the FAB rendered 56×40 with a
		12px radius. The element-qualified selector outranks any single utility. */
	:global(button.sidebar-fab) {
		position: fixed;
		bottom: var(--fab-bottom-1);
		right: var(--fab-right-1);
		width: var(--fab-size);
		height: var(--fab-size);
		padding: 0;
		/* --radius-full, not a hardcoded circle — the style shuffle's Sharp preset
			flattens it to 4px and the FAB must follow like every other control. */
		border-radius: var(--radius-full);
		z-index: var(--z-fab);
		box-shadow: var(--shadow-lg);
	}
</style>
