<script lang="ts">
	import type { Snippet } from 'svelte';
	import { TabNav } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Connection', href: '/showcases/db/graph/connection' },
		{ label: 'Model', href: '/showcases/db/graph/model' },
		{ label: 'Traversal', href: '/showcases/db/graph/traversal' },
	];
</script>

<TabNav {tabs} ariaLabel="Graph sections" />

<div class="pt-6">
	{@render children()}
</div>
