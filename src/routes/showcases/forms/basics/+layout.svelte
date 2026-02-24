<script lang="ts">
	import type { Snippet } from 'svelte';
	import { TabNav } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Contact', href: '/showcases/forms/basics/contact' },
		{ label: 'Settings', href: '/showcases/forms/basics/settings' },
	];
</script>

<TabNav {tabs} ariaLabel="Basics sections" />

<div class="pt-6">
	{@render children()}
</div>
