<script lang="ts">
	import type { Snippet } from 'svelte';
	import { TabNav } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Confirm', href: '/showcases/forms/advanced/confirm' },
		{ label: 'Reset', href: '/showcases/forms/advanced/reset' },
		{ label: 'Edit', href: '/showcases/forms/advanced/edit' },
	];
</script>

<TabNav {tabs} ariaLabel="Advanced sections" />

<div class="pt-6">
	{@render children()}
</div>
