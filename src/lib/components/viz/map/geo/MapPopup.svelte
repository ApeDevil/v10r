<script lang="ts">
import type { Component, Snippet } from 'svelte';
import { onMount } from 'svelte';

interface Props {
	offset?: number;
	closeButton?: boolean;
	class?: string;
	children?: Snippet;
}

let { offset = 25, closeButton = true, class: className, children }: Props = $props();

let PopupComp: Component<Record<string, unknown>> | undefined = $state();

onMount(async () => {
	const sml = await import('svelte-maplibre-gl');
	PopupComp = sml.Popup;
});
</script>

{#if PopupComp && children}
	<PopupComp {offset} {closeButton} class={className}>
		{@render children()}
	</PopupComp>
{/if}
