<script lang="ts">
import type { Snippet } from 'svelte';
import { ShowcaseLayout } from '$lib/components/composites';
import { getShowcaseTabs } from '../showcases';

let { children }: { children: Snippet } = $props();

const tabs = getShowcaseTabs('/showcases/analytics');
</script>

<ShowcaseLayout
	title="Analytics"
	description="Privacy-first analytics — page views, user journeys, funnels, and real-time events."
	breadcrumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Showcases', href: '/showcases' },
		{ label: 'Analytics' }
	]}
	{tabs}
	ariaLabel="Analytics showcase"
>
	{@render children()}
</ShowcaseLayout>
