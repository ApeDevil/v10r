<script lang="ts">
/**
 * Surface - a tonal-elevation plane.
 *
 * Renders an element one elevation rung above its parent surface (app background = 0),
 * resolved via context so nesting auto-increments: background → sidebar → menu → panel each
 * climb a step without naming a number. Pass `level` only to pin a reset root. Structural
 * chrome uses this component; primitives that stamp elevation on a Bits `.Content` they don't
 * wrap call the `useSurface()` hook directly instead (no extra DOM node).
 */
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type SurfaceOptions, useSurface } from '$lib/styles/elevation';
import { cn } from '$lib/utils/cn';

interface Props extends HTMLAttributes<HTMLElement>, SurfaceOptions {
	/** Element tag to render. Defaults to a div. */
	as?: string;
	children: Snippet;
}

let { level, as = 'div', class: className, children, ...rest }: Props = $props();

const s = useSurface({ level });
</script>

<svelte:element this={as} class={cn(className)} {...rest} {...s.attrs}>
	{@render children()}
</svelte:element>
