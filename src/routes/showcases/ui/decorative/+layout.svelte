<script lang="ts">
	import type { Snippet } from 'svelte';
	import { TabNav } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Ornaments', href: '/showcases/ui/decorative/ornaments' },
		{ label: 'Backgrounds', href: '/showcases/ui/decorative/backgrounds' },
	];
</script>

<TabNav {tabs} ariaLabel="Decorative categories" />

<div class="pt-6">
	{@render children()}
</div>
