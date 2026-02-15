<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet, Component } from 'svelte';

	interface Props {
		lnglat: { lng: number; lat: number };
		draggable?: boolean;
		children?: Snippet;
	}

	let {
		lnglat,
		draggable = false,
		children,
	}: Props = $props();

	let MarkerComp: Component<any> | undefined = $state();

	onMount(async () => {
		const sml = await import('svelte-maplibre-gl');
		MarkerComp = sml.Marker;
	});
</script>

{#if MarkerComp}
	<MarkerComp {lnglat} {draggable}>
		{#if children}
			{@render children()}
		{/if}
	</MarkerComp>
{/if}
