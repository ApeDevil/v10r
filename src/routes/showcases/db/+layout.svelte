<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ShowcaseLayout } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Relational', href: '/showcases/db/relational' },
		{ label: 'Graph', href: '/showcases/db/graph' },
		{ label: 'Storage', href: '/showcases/db/storage' },
		{ label: 'Cache', href: '/showcases/db/cache' },
	];
</script>

<ShowcaseLayout
	title="Database"
	description="Database engines, connection patterns, type systems, and data strategies."
	breadcrumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Showcases', href: '/showcases' },
		{ label: 'DB' }
	]}
	{tabs}
	ariaLabel="Database engines"
>
	{@render children()}
</ShowcaseLayout>
