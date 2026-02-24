<script lang="ts">
	import type { Snippet } from 'svelte';
	import { TabNav } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Wizard', href: '/showcases/forms/patterns/wizard' },
		{ label: 'Dynamic', href: '/showcases/forms/patterns/dynamic' },
		{ label: 'Dependent', href: '/showcases/forms/patterns/dependent' },
	];
</script>

<TabNav {tabs} ariaLabel="Patterns sections" />

<div class="pt-6">
	{@render children()}
</div>
