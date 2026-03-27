<script lang="ts">
/**
 * Logo/branding for sidebar.
 * Rail mode: "v10r" (collapsed)
 * Expanded mode: "velociraptor"
 */

import { localizeHref } from '$lib/i18n';
import { getSidebar } from '$lib/state/sidebar.svelte';
import { cn } from '$lib/utils/cn';

interface Props {
	forceExpanded?: boolean; // Force expanded mode (for drawer)
	class?: string;
}

let { forceExpanded = false, class: className }: Props = $props();

const sidebar = getSidebar();

const showText = $derived(forceExpanded || sidebar.expanded);
</script>

<a href={localizeHref('/')} style:min-height="var(--sidebar-item-size)" class={cn('logo-link flex items-center relative no-underline rounded-md transition-colors duration-fast hover:bg-fg-alpha focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 motion-reduce:transition-none', showText ? 'px-3' : 'justify-center rail-item', className)} aria-label="Home">
	<span
		class={cn('logo-short font-bold text-fg transition-opacity duration-fast motion-reduce:transition-none', showText ? 'opacity-0' : 'opacity-100')}
		style="font-size: var(--sidebar-icon-size, 1.25rem)"
		aria-hidden={showText}
	>v10r</span>
	<span
		class={cn('logo-full font-bold text-base text-fg whitespace-nowrap absolute left-3', showText ? 'logo-visible' : 'logo-hidden')}
	>Velociraptor</span>
</a>

<style>
	/* "Velociraptor" overlays "v10r" — same vertical position, no DOM swap */
	.logo-full {
		transition: opacity var(--duration-fast);
	}

	.logo-hidden {
		opacity: 0;
		pointer-events: none;
	}

	.logo-visible {
		opacity: 1;
	}

	@media (prefers-reduced-motion: reduce) {
		.logo-full {
			transition: none;
		}
	}
</style>
