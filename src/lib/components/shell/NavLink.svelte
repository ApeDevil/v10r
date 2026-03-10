<script lang="ts">
/**
 * Navigation link primitive with active state styling.
 * Owns the <a> element, aria-current, and primary bg/on-primary text
 * via scoped CSS — deterministic specificity over utility classes.
 *
 * Composed by NavItem, NavAccordion, and NavFlyout.
 */

import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes } from 'svelte/elements';
import { cn } from '$lib/utils/cn';

interface Props extends HTMLAnchorAttributes {
	active?: boolean;
	children: Snippet;
	class?: string;
}

let { active = false, children, class: className, ...rest }: Props = $props();
</script>

<a
	class={cn(className, active && 'nav-active font-semibold')}
	aria-current={active ? 'page' : undefined}
	{...rest}
>
	{@render children()}
</a>

<style>
	/* Active state: primary bg with on-primary text */
	a:global(.nav-active) {
		background-color: var(--color-primary);
		color: var(--color-on-primary);
	}

	a:global(.nav-active):hover {
		background-color: var(--color-primary-hover);
		color: var(--color-on-primary);
	}
</style>
