<script lang="ts">
	import type { Snippet } from 'svelte';
	import { TabNav } from '$lib/components/composites';
	import { getShowcaseSubTabs } from '../../showcases';

	let { children }: { children: Snippet } = $props();

	const tabs = getShowcaseSubTabs('/showcases/db/graph');
</script>

<TabNav {tabs} ariaLabel="Graph sections" />

<div class="pt-6">
	{@render children()}
</div>
