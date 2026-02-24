<script lang="ts">
	import type { Snippet } from 'svelte';
	import { TabNav } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Primitives', href: '/showcases/ui/components/primitives' },
		{ label: 'Composites', href: '/showcases/ui/components/composites' },
	];
</script>

<TabNav {tabs} ariaLabel="Component categories" />

<div class="pt-6">
	{@render children()}
</div>
