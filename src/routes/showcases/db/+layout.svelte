<script lang="ts">
	import type { Snippet } from 'svelte';
	import { PageContainer } from '$lib/components/layout';
	import { PageHeader, TabNav } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Relational', href: '/showcases/db/relational' },
		{ label: 'Graph', href: '/showcases/db/graph' },
		{ label: 'Storage', href: '/showcases/db/storage' },
		{ label: 'Cache', href: '/showcases/db/cache' },
	];
</script>

<PageContainer class="py-7">
	<PageHeader
		title="Database"
		description="Database engines, connection patterns, type systems, and data strategies."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'DB' }
		]}
	/>

	<TabNav {tabs} ariaLabel="Database engines" />

	<div class="pt-6">
		{@render children()}
	</div>
</PageContainer>
