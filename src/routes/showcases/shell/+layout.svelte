<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ShowcaseLayout } from '$lib/components/composites';
	import { getShowcaseTabs } from '../showcases';

	let { children }: { children: Snippet } = $props();

	const tabs = getShowcaseTabs('/showcases/shell');
</script>

<ShowcaseLayout
	title="App Shell Demo"
	description="Interactive demonstration of the app shell components and state management."
	breadcrumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Showcases', href: '/showcases' },
		{ label: 'Shell' }
	]}
	{tabs}
	ariaLabel="Shell sections"
>
	{@render children()}
</ShowcaseLayout>
