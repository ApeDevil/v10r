<script lang="ts">
	import type { Snippet } from 'svelte';
	import { TabNav } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Connection', href: '/showcases/db/relational/connection' },
		{ label: 'Types', href: '/showcases/db/relational/types' },
		{ label: 'Mutability', href: '/showcases/db/relational/mutability' },
	];
</script>

<TabNav {tabs} ariaLabel="Relational sections" />

<div class="pt-6">
	{@render children()}
</div>
