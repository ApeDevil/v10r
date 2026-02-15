<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet, Component } from 'svelte';

	interface Props {
		offset?: number;
		closeButton?: boolean;
		class?: string;
		children?: Snippet;
	}

	let {
		offset = 25,
		closeButton = true,
		class: className,
		children,
	}: Props = $props();

	let PopupComp: Component<any> | undefined = $state();

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
