<script lang="ts">
	import type { Snippet } from 'svelte';
	import { TabNav } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Connection', href: '/showcases/db/storage/connection' },
		{ label: 'Objects', href: '/showcases/db/storage/objects' },
		{ label: 'Transfer', href: '/showcases/db/storage/transfer' },
	];
</script>

<TabNav {tabs} ariaLabel="Storage sections" />

<div class="pt-6">
	{@render children()}
</div>
