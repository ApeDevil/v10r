<script lang="ts">
import type { Component, Snippet } from 'svelte';
import { onMount } from 'svelte';

interface Props {
	lnglat: { lng: number; lat: number };
	draggable?: boolean;
	children?: Snippet;
}

let { lnglat, draggable = false, children }: Props = $props();

let MarkerComp: Component<Props> | undefined = $state();

onMount(async () => {
	const sml = await import('svelte-maplibre-gl');
	MarkerComp = sml.Marker as unknown as Component<Props>;
});
</script>

{#if MarkerComp}
	<MarkerComp {lnglat} {draggable}>
		{#if children}
			{@render children()}
		{/if}
	</MarkerComp>
{/if}
