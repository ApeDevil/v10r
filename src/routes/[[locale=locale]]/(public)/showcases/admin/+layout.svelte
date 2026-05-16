<script lang="ts">
import type { Snippet } from 'svelte';
import { ShowcaseLayout } from '$lib/components/composites';
import { getShowcaseTabs } from '../showcases';

let { children }: { children: Snippet } = $props();

const tabs = getShowcaseTabs('/showcases/admin');
</script>

<ShowcaseLayout
	title="Admin & Privacy"
	description="The accountability surface for v10r.dev — who collects what, why it's lawful, how long it's kept, and how to exercise your rights."
	breadcrumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Showcases', href: '/showcases' },
		{ label: 'Admin & Privacy' }
	]}
	{tabs}
	ariaLabel="Admin and privacy showcase"
>
	{@render children()}
</ShowcaseLayout>
