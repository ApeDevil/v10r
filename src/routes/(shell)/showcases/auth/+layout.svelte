<script lang="ts">
import type { Snippet } from 'svelte';
import { ShowcaseLayout } from '$lib/components/composites';
import { getShowcaseTabs } from '../showcases';

let { children }: { children: Snippet } = $props();

const tabs = getShowcaseTabs('/showcases/auth');
</script>

<ShowcaseLayout
	title="Auth"
	description="Better Auth session-based authentication — connection health, session lifecycle, and security diagnostics."
	breadcrumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Showcases', href: '/showcases' },
		{ label: 'Auth' }
	]}
	{tabs}
	ariaLabel="Auth sections"
>
	{@render children()}
</ShowcaseLayout>
