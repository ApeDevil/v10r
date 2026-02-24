<script lang="ts">
	import type { Snippet } from 'svelte';
	import { TabNav } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Realtime', href: '/showcases/forms/validation/realtime' },
		{ label: 'Async', href: '/showcases/forms/validation/async' },
		{ label: 'Server', href: '/showcases/forms/validation/server' },
	];
</script>

<TabNav {tabs} ariaLabel="Validation sections" />

<div class="pt-6">
	{@render children()}
</div>
