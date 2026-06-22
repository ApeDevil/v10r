<script lang="ts">
import type { Snippet } from 'svelte';
import { ShowcaseLayout } from '$lib/components/composites';
import { getShowcaseTabs } from '../showcases';

let { children }: { children: Snippet } = $props();

const tabs = getShowcaseTabs('/showcases/toolkits');
</script>

<ShowcaseLayout
	title="Toolkits"
	description="Bundled, multi-step tools — upload once, run an AI pipeline, adjust the results, then approve. Nothing is saved."
	breadcrumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Showcases', href: '/showcases' },
		{ label: 'Toolkits' }
	]}
	{tabs}
	ariaLabel="Toolkit sections"
	width="wide"
	containerClass="pt-7"
>
	{@render children()}
</ShowcaseLayout>
