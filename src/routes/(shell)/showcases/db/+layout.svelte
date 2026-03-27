<script lang="ts">
import type { Snippet } from 'svelte';
import { ShowcaseLayout } from '$lib/components/composites';
import { getShowcaseTabs } from '../showcases';

let { children }: { children: Snippet } = $props();

const tabs = getShowcaseTabs('/showcases/db');
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
