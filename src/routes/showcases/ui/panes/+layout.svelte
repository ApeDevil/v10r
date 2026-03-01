<script lang="ts">
	import type { Snippet } from 'svelte';
	import { TabNav } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Resizable', href: '/showcases/ui/panes/resizable' },
		{ label: 'Reorderable', href: '/showcases/ui/panes/reorderable' },
		{ label: 'Panels', href: '/showcases/ui/panes/panels' },
	];
</script>

<TabNav {tabs} ariaLabel="Pane types" />

<div class="pt-6">
	{@render children()}
</div>

