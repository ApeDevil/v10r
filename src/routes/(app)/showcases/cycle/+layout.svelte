<script lang="ts">
import type { Snippet } from 'svelte';
import { ShowcaseLayout } from '$lib/components/composites';
import { getShowcaseTabs } from '../showcases';

let { children }: { children: Snippet } = $props();

const tabs = getShowcaseTabs('/showcases/cycle');
</script>

<ShowcaseLayout
	title="Request Cycle"
	description="Visualize the complete SvelteKit request lifecycle — from user input through server, domain, and database."
	breadcrumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Showcases', href: '/showcases' },
		{ label: 'Cycle' }
	]}
	{tabs}
	ariaLabel="Cycle showcase tabs"
>
	{@render children()}
</ShowcaseLayout>
