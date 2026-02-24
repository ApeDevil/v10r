<script lang="ts">
	import type { Snippet } from 'svelte';
	import { PageContainer } from '$lib/components/layout';
	import { PageHeader, TabNav } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Basics', href: '/showcases/forms/basics' },
		{ label: 'Validation', href: '/showcases/forms/validation' },
		{ label: 'Patterns', href: '/showcases/forms/patterns' },
		{ label: 'Advanced', href: '/showcases/forms/advanced' },
	];
</script>

<PageContainer class="py-7">
	<PageHeader
		title="Forms"
		description="Form validation patterns with Superforms v2 + Valibot v1."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'Forms' }
		]}
	/>

	<TabNav {tabs} ariaLabel="Form sections" />

	<div class="pt-6">
		{@render children()}
	</div>
</PageContainer>
