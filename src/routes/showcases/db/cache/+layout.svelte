<script lang="ts">
	import type { Snippet } from 'svelte';
	import { TabNav } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Connection', href: '/showcases/db/cache/connection' },
		{ label: 'Patterns', href: '/showcases/db/cache/patterns' },
		{ label: 'Ephemeral', href: '/showcases/db/cache/ephemeral' },
	];
</script>

<TabNav {tabs} ariaLabel="Cache sections" />

<div class="pt-6">
	{@render children()}
</div>
